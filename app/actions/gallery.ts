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

export async function getUserGenerations(email: string | undefined, userId: string) {
    try {
        if (!userId) {
            return { success: false, error: "User ID is required" };
        }

        // Fetch from DB 'generations' table
        // We prioritize DB records as they contain the R2 links and metadata
        const { data: dbGenerations, error: dbError } = await supabaseAdmin
            .from('generations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (dbError) {
            console.error("Error fetching generations from DB:", dbError);
            return { success: false, error: dbError.message };
        }

        // Map DB fields to expected Interface
        const images = dbGenerations.map((gen: any) => ({
            id: gen.id,
            url: gen.image_url, // Column name from api/generate
            title: gen.title || 'Portrait',
            created_at: gen.created_at,
            prompt: gen.prompt // Optional, useful if UI wants it later
        }));

        return { success: true, images };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}
