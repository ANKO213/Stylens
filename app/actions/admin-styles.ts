"use server";

import { createClient } from "@supabase/supabase-js";

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

export async function updateStyle(id: string, formData: any) {
    try {
        const { error } = await supabaseAdmin
            .from("styles")
            .update({
                title: formData.title,
                prompt: formData.prompt,
                image_url: formData.image_url,
                // explicit exclusion of updated_at if not in schema
            })
            .eq("id", id);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error("Server Action Update Error:", error);
        return { success: false, error: error.message };
    }
}

export async function createStyle(formData: any) {
    try {
        const { data, error } = await supabaseAdmin
            .from("styles")
            .insert({
                title: formData.title,
                prompt: formData.prompt,
                image_url: formData.image_url,
                model_config: {}
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (error: any) {
        console.error("Server Action Create Error:", error);
        return { success: false, error: error.message };
    }
}
