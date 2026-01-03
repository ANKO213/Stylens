"use server";

import { createClient } from "@supabase/supabase-js";

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

const CORRECT_STORAGE_BASE = "https://dgsvyelmvhybhphdxnvk.supabase.co/storage/v1/object/public/style-images/styles/";

export async function fixAllStyleUrls() {
    try {
        // 1. Fetch all styles
        const { data: styles, error: fetchError } = await supabaseAdmin
            .from("styles")
            .select("*");

        if (fetchError) throw fetchError;
        if (!styles) return { success: true, message: "No styles found" };

        let updatedCount = 0;
        let errors = [];

        // 2. Iterate and Fix
        for (const style of styles) {
            const currentUrl = style.image_url || "";
            // Extract filename (handle various potential messiness)
            const filename = currentUrl.split('/').pop();

            if (!filename) continue;

            // Construct strict correct URL
            const correctUrl = `${CORRECT_STORAGE_BASE}${filename}`;

            // Only update if different
            if (currentUrl !== correctUrl) {
                console.log(`Fixing URL for ${style.id}: ${currentUrl} -> ${correctUrl}`);

                const { error: updateError } = await supabaseAdmin
                    .from("styles")
                    .update({ image_url: correctUrl })
                    .eq("id", style.id);

                if (updateError) {
                    errors.push(`Failed to update ${style.id}: ${updateError.message}`);
                } else {
                    updatedCount++;
                }
            }
        }

        return {
            success: true,
            message: `Fixed ${updatedCount} URLs. Errors: ${errors.length}`,
            details: errors
        };

    } catch (error: any) {
        console.error("Fix DB Error:", error);
        return { success: false, error: error.message };
    }
}
