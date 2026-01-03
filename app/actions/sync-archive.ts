"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function syncUserGenerations() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
        return { success: false, error: "User not authenticated" };
    }

    const email = user.email;
    const userId = user.id;

    try {
        console.log(`[Sync] Starting sync for ${email}...`);

        // 1. List R2 Objects
        // Folder: generations/{email}/
        const folderPrefix = `generations/${email}/`;

        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: folderPrefix
        });

        const listResponse = await r2.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return { success: true, count: 0, message: "No files found in R2" };
        }

        console.log(`[Sync] Found ${listResponse.Contents.length} files in R2.`);

        // 2. Get Existing DB Records to avoid duplicates
        const { data: existingRecords } = await supabaseAdmin
            .from("generations")
            .select("image_url")
            .eq("user_id", userId);

        const existingUrls = new Set(existingRecords?.map(r => r.image_url) || []);
        let addedCount = 0;

        // 3. Insert Missing
        for (const sendObj of listResponse.Contents) {
            if (!sendObj.Key) continue;

            const publicUrl = `${R2_PUBLIC_DOMAIN}/${sendObj.Key}`;

            if (existingUrls.has(publicUrl)) {
                continue;
            }

            // Extract prompt/title from filename or default?
            // Filename: generations/email/prompt-date-random.png
            // We can't easily recover exact prompt inside DB, but we can store something.
            const filename = sendObj.Key.split('/').pop() || "generation";
            // sanitizedTitle-date....
            // Attempt to make it readable?
            const title = "Restored from Archive";

            await supabaseAdmin.from("generations").insert({
                user_id: userId,
                image_url: publicUrl,
                title: title,
                prompt: "Restored from R2 storage",
                model: "gemini-3-pro",
                created_at: sendObj.LastModified ? sendObj.LastModified.toISOString() : new Date().toISOString()
            });

            addedCount++;
        }

        console.log(`[Sync] Synced ${addedCount} new records.`);
        return { success: true, count: addedCount };

    } catch (error: any) {
        console.error("Sync Error:", error);
        return { success: false, error: error.message };
    }
}
