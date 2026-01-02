import { createBrowserClient } from '@supabase/ssr'

const mockSupabase = {
    auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: "Supabase not configured (missing env vars)" } }),
        signUp: async () => ({ data: null, error: { message: "Supabase not configured (missing env vars)" } }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    },
    from: () => ({
        select: () => ({
            eq: () => ({
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                order: () => ({ data: [], error: null }),
            }),
            order: () => ({ data: [], error: null }),
        }),
        upsert: async () => ({ error: { message: "Supabase not configured" } }),
    }),
    storage: {
        from: () => ({
            upload: async () => ({ error: { message: "Supabase not configured" } }),
            getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
    },
}

export function createClient() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn("Returning Mock Supabase Client due to missing env vars");
        return mockSupabase as any;
    }

    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}
