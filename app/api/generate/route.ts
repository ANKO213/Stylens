import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Import direct client for Admin access

// --- ADMIN CLIENT FOR SYSTEM OPERATIONS (Bypasses RLS) ---
export async function POST(req: NextRequest) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        const { prompt, faceUrl, additionalFaceUrls, title } = await req.json();

        // Construct Prompt
        const basePrompt = `${prompt}.
IMPORTANT: High quality, photorealistic, cinematic lighting, 8k resolution.`;

        // Refined Prompt for Identity Preservation
        const finalPrompt = `Generate an image based on this prompt: ${basePrompt}. 
IMPORTANT: The character in the image MUST have the exact same facial features and likeness as the person in the attached ALL attached reference images. Look at all reference photos to understand the facial structure from different angles. Preserve identity strictly.`;

        // ... (Credit Check Logic Omitted for Brevity - It remains the same, inserted below by keeping context) ...

        // --- CREDIT CHECK & DEDUCTION ---
        // Use Server Client for Auth Check (Respects Session)
        const { createClient: createServerClient } = await import("@/utils/supabase/server");
        const supabaseUserClient = await createServerClient();

        const { data: { user: sessionUser } } = await supabaseUserClient.auth.getUser();
        const userId = sessionUser?.id;

        if (!userId) {
            return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
        }

        // 1. Get Current Balance
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const currentBalance = profile.credits || 0;
        const COST = 100;

        if (currentBalance < COST) {
            return NextResponse.json({
                error: "Insufficient credits. Please top up your balance."
            }, { status: 403 });
        }

        // 2. Deduct Credits
        const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({ credits: currentBalance - COST })
            .eq("id", userId);

        if (updateError) {
            return NextResponse.json({ error: "Failed to deduct credits" }, { status: 500 });
        }

        // Sync Email to Profile (Opportunistic)
        if (sessionUser?.email) {
            await supabaseAdmin
                .from("profiles")
                .update({ email: sessionUser.email })
                .eq("id", userId);
        }
        // --------------------------------
        console.log("Running Gemini 3 Pro generation...", { prompt: finalPrompt, hasFace: !!faceUrl, extraFaces: additionalFaceUrls?.length });

        const messages: any[] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": finalPrompt
                    }
                ]
            }
        ];

        // Add Main Face Image if available
        if (faceUrl) {
            messages[0].content.push({
                "type": "image_url",
                "image_url": { "url": faceUrl }
            });
        }

        // Add Additional Face Images if available
        if (additionalFaceUrls && Array.isArray(additionalFaceUrls)) {
            additionalFaceUrls.forEach((url: string) => {
                if (url) {
                    messages[0].content.push({
                        "type": "image_url",
                        "image_url": { "url": url }
                    });
                }
            });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://faceai.app",
                "X-Title": "FaceAI",
            },
            body: JSON.stringify({
                model: "google/gemini-3-pro-image-preview",
                messages: messages,
                modalities: ["image", "text"]
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            // REFUND
            await supabaseAdmin.from("profiles").update({ credits: currentBalance }).eq("id", userId);
            throw new Error(`OpenRouter API Error: ${response.status} - ${errorText} `);
        }

        const result = await response.json();

        let base64Image: string | null = null;

        // Extract Base64 from Gemini response structure
        if (result.choices && result.choices[0]?.message?.images) {
            const images = result.choices[0].message.images;
            if (images.length > 0) {
                base64Image = images[0].image_url.url; // Usually data:image/png;base64,... or just base64
            }
        }

        if (!base64Image) {
            // Try standard content parsing if structure differs or if it returned text refusal
            console.error("Unexpected Gemini response structure:", JSON.stringify(result, null, 2));
            await supabaseAdmin.from("profiles").update({ credits: currentBalance }).eq("id", userId);
            return NextResponse.json({ error: "No image generated by model." }, { status: 500 });
        }

        // Clean base64 string if it has data URI prefix
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Construct New Filename: {email}/{sanitizedTitle}-{date}-{random}.png
        const userEmail = sessionUser.email || userId;
        const sanitizedTitle = (title || "generation").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().split('T')[0];
        const randomSuffix = Math.random().toString(36).substring(7);

        const filePath = `${userEmail}/${sanitizedTitle}-${dateStr}-${randomSuffix}.png`;

        const { data: buckets } = await supabaseAdmin.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === "generations");

        if (!bucketExists) {
            const { error: createError } = await supabaseAdmin.storage.createBucket("generations", {
                public: true,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"]
            });

            if (createError) {
                console.error("Bucket Creation Error:", createError);
                // Try to proceed anyway, maybe race condition or it exists now
            }
        }

        const { error: uploadError } = await supabaseAdmin.storage
            .from("generations")
            .upload(filePath, buffer, {
                contentType: "image/png",
                upsert: true
            });

        if (uploadError) {
            console.error("Storage Upload Error:", uploadError);
            await supabaseAdmin.from("profiles").update({ credits: currentBalance }).eq("id", userId);
            return NextResponse.json({ error: `Storage Error: ${uploadError.message}` }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("generations")
            .getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            imageUrl: publicUrl
        });

    } catch (error: any) {
        console.error("Generation Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to generate image."
        }, { status: 500 });
    }
}
