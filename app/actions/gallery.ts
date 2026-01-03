"use server";

import { createClient } from "@supabase/supabase-js";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

// Initialize Admin Client (kept for auth/other needs if any, but fetching is now R2 direct)
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
        if (!email) {
            // Fallback to userId if email not provided (though R2 structure relies on email currently)
            // If we strictly used email folders, we need email.
            return { success: false, error: "User Email is required for R2 lookup" };
        }

        console.log(`[Gallery] Fetching directly from R2 for: ${email}`);

        const folderPrefix = `generations/${email}/`;

        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: folderPrefix
        });

        const listResponse = await r2.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return { success: true, images: [] };
        }

        // Map R2 Objects to Gallery Interface
        const images = listResponse.Contents
            .filter(file => file.Key && !file.Key.endsWith('/')) // Filter out folder markers if any
            .map((file, index) => {
                const publicUrl = `${R2_PUBLIC_DOMAIN}/${file.Key}`;
                // Extract clean title from filename
                // Format: generations/email/filename-date-id.png
                // specific format: title-date-id.png
                const basename = file.Key?.split('/').pop() || "Untitled";

                // Simple parsing: Remove extension and last segment (id) if possible, or just use basename
                // Let's just use basename for now to be safe and visible
                let title = basename.replace(/\.[^/.]+$/, ""); // remove extension

                return {
                    id: file.ETag || `r2-${index}`, // Use ETag or index as ID
                    url: publicUrl,
                    title: title,
                    created_at: file.LastModified ? file.LastModified.toISOString() : new Date().toISOString(),
                    prompt: "" // Metadata not stored in R2 object list
                };
            });

        // Sort by date desc
        images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { success: true, images };

    } catch (error: any) {
        console.error("Server Action Error (R2):", error);
        return { success: false, error: error.message };
    }
}
