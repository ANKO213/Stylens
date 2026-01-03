"use server";

import { createClient } from "@supabase/supabase-js";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function deleteStyle(id: string) {
    try {
        // 1. Fetch style to get image URL
        const { data: style, error: fetchError } = await supabaseAdmin
            .from("styles")
            .select("image_url")
            .eq("id", id)
            .single();

        if (fetchError) throw new Error("Style not found");

        // 2. Delete from R2 if it's an R2 URL
        if (style.image_url) {
            const url = style.image_url;
            // Extract Key: everything after the domain
            // Assumptions: 
            // R2 Domain: https://pub-....r2.dev/feed-styles/filename
            // Key: feed-styles/filename

            // Check if it's an R2 URL or Supabase URL
            if (url.includes("r2.dev")) {
                try {
                    const key = url.split('.r2.dev/')[1];
                    if (key) {
                        console.log(`Deleting R2 object: ${key}`);
                        await r2.send(new DeleteObjectCommand({
                            Bucket: R2_BUCKET_NAME,
                            Key: key
                        }));
                    }
                } catch (e) {
                    console.error("Failed to delete from R2:", e);
                    // Continue to delete from DB anyway
                }
            }
            // Optional: Handle Legacy Supabase Storage cleanup if needed
            // else if (url.includes("supabase.co")) { ... }
        }

        // 3. Delete from DB
        const { error: deleteError } = await supabaseAdmin
            .from("styles")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        return { success: true };

    } catch (error: any) {
        console.error("Delete Style Error:", error);
        return { success: false, error: error.message };
    }
}
