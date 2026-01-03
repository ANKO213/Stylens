"use server";

import { createClient } from "@supabase/supabase-js";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

// Initialize Admin Client
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

export async function getUserGenerations(email: string | undefined, userId: string) {
    try {
        if (!userId) {
            return { success: false, error: "User ID is required" };
        }

        // Fetch from DB 'generations' table
        const { data: dbGenerations, error: dbError } = await supabaseAdmin
            .from('generations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (dbError) {
            console.error("Error fetching generations from DB:", dbError);
            return { success: false, error: dbError.message };
        }

        let images = dbGenerations.map((gen: any) => ({
            id: gen.id,
            url: gen.image_url,
            title: gen.title || 'Portrait',
            created_at: gen.created_at,
            prompt: gen.prompt
        }));

        // AUTO-SYNC: If DB is empty but R2 might have files (migration fallback)
        if (images.length === 0 && email) {
            console.log("DB empty, checking R2 for auto-sync...");
            try {
                const folderPrefix = `generations/${email}/`;
                const listCommand = new ListObjectsV2Command({
                    Bucket: R2_BUCKET_NAME,
                    Prefix: folderPrefix
                });
                const listResponse = await r2.send(listCommand);

                if (listResponse.Contents && listResponse.Contents.length > 0) {
                    console.log(`Found ${listResponse.Contents.length} files in R2. Syncing...`);
                    const newRecords = [];

                    for (const file of listResponse.Contents) {
                        if (!file.Key) continue;
                        const publicUrl = `${R2_PUBLIC_DOMAIN}/${file.Key}`;
                        const filename = file.Key.split('/').pop() || "recovered";
                        const createdAt = file.LastModified ? file.LastModified.toISOString() : new Date().toISOString();

                        // Prepare record
                        newRecords.push({
                            user_id: userId,
                            image_url: publicUrl,
                            title: "Restored",
                            prompt: "Auto-synced from storage",
                            model: "gemini-3-pro",
                            created_at: createdAt
                        });
                    }

                    // Batch Insert
                    if (newRecords.length > 0) {
                        const { error: insertError } = await supabaseAdmin
                            .from("generations")
                            .insert(newRecords);

                        if (insertError) {
                            console.error("Auto-sync insert error:", insertError);
                        } else {
                            // Update the return list immediately
                            const syncedImages = newRecords.map((r, idx) => ({
                                id: `synced-${idx}`,
                                url: r.image_url,
                                title: r.title,
                                created_at: r.created_at,
                                prompt: r.prompt
                            }));
                            // Sort again
                            images = syncedImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        }
                    }
                }
            } catch (syncError) {
                console.error("Auto-sync failed:", syncError);
                // Don't fail the request, just return empty list
            }
        }

        return { success: true, images };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}
