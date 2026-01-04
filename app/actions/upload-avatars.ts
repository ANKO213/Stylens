"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function uploadAvatars(formData: FormData) {
    // 1. Authenticate User
    const supabaseUserClient = await createServerClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user || !user.email) {
        return { error: "User not authenticated or email missing" };
    }

    const email = user.email;
    const userId = user.id;

    // 2. Initialize Admin Client (for DB updates)
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
        const { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } = await import("@/lib/r2");
        const { PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");

        // --- STRICT FOLDER ENFORCEMENT ---
        // R2 Structure: avatars/{email}/
        const folderPrefix = `avatars/${email}/`;

        console.log(`[AvatarUpload R2] Start. User: ${email}`);

        // 3. CLEANUP PHASE: "Clean Slate"
        // List everything in the user's folder
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: folderPrefix
        });

        const listResponse = await r2.send(listCommand);

        if (listResponse.Contents && listResponse.Contents.length > 0) {
            console.log(`[AvatarUpload R2] Found ${listResponse.Contents.length} old files. Deleting...`);
            const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: {
                    Objects: objectsToDelete,
                    Quiet: true
                }
            });

            await r2.send(deleteCommand);
            console.log("[AvatarUpload R2] Cleanup successful.");
        }

        // 4. UPLOAD PHASE
        const mainFile = formData.get("main") as File;
        const side1File = formData.get("side1") as File;
        const side2File = formData.get("side2") as File;

        if (!mainFile) return { error: "Main photo is required" };

        let finalAvatarUrl = "";

        // Helper
        const processUpload = async (file: File, name: string) => {
            const buffer = Buffer.from(await file.arrayBuffer());

            // No extension to ensure predictable URLs for the client (side1, side2)
            const fileName = name;
            // Path: avatars/{email}/{fileName}
            const key = `${folderPrefix}${fileName}`;

            console.log(`[AvatarUpload R2] Uploading ${name} to ${key}`);

            await r2.send(new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: file.type,
            }));

            // Construct Public URL
            // Ensure no double slashes if domain ends with slash
            if (!R2_PUBLIC_DOMAIN) throw new Error("R2_PUBLIC_DOMAIN is not defined");
            const domain = R2_PUBLIC_DOMAIN.replace(/\/$/, "");
            const publicUrl = `${domain}/${key}`;

            console.log(`[AvatarUpload R2] Success: ${publicUrl}`);
            return publicUrl;
        };

        // A. Upload Main
        const mainUrl = await processUpload(mainFile, "main");

        // With R2, we might still want a cache buster parameter for the DB just in case Cloudflare caches aggressively at the edge
        finalAvatarUrl = `${mainUrl}?t=${Date.now()}`;

        // B. Upload Sides
        if (side1File) await processUpload(side1File, "side1");
        if (side2File) await processUpload(side2File, "side2");

        // 5. UPDATE DB
        const { error: dbError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: finalAvatarUrl })
            .eq("id", userId);

        if (dbError) throw dbError;

        console.log("[AvatarUpload R2] Complete. DB updated.");
        return { success: true, avatarUrl: finalAvatarUrl };

    } catch (error: any) {
        console.error("Upload Avatars Fatal Error (R2):", error);
        return { error: error.message || "Server upload failed" };
    }
}
