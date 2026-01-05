"use server";

import { createClient } from "@/utils/supabase/server";

export async function syncUserProfile(userId: string, username: string, email: string) {
    const supabase = await createClient();

    // Note: Since the user might not be logged in yet (email confirmation), 
    // we need to be careful. The standard `createClient` uses the user's cookie.
    // If the user isn't logged in, this client acts as anon.
    // To bypass RLS and write to another user's profile (or their own before login),
    // we strictly need the SERVICE_ROLE_KEY.

    // However, usually we don't expose service role key in client/server utils directly
    // unless explicitly configured.

    // Let's check if we can assume the user IS logged in or if we can use a service role client.
    // If we don't have a service role client setup, we might need to rely on the metadata trigger
    // or set up an admin client here.

    // Check for service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
        const { createClient: createAdminClient } = require('@supabase/supabase-js');
        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        const { error } = await adminClient
            .from('profiles')
            .upsert({
                id: userId,
                username,
                email,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Admin sync error:", error);
            return { success: false, error: error.message };
        }
        return { success: true };
    }

    // Fallback if no service key (unsafe for unconfirmed emails but better than nothing if session exists)
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            username,
            email,
            updated_at: new Date().toISOString()
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
