"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

export function useUserProfile() {
    const [user, setUser] = useState<User | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    const refreshProfile = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
            const { data } = await supabase
                .from("profiles")
                .select("avatar_url, credits")
                .eq("id", user.id)
                .single();

            setAvatarUrl(data?.avatar_url || null);
            setCredits(data?.credits || 0);
        } else {
            setAvatarUrl(null);
            setCredits(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshProfile();

        const { data: authListener } = supabase.auth.onAuthStateChange(() => {
            refreshProfile();
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return { user, avatarUrl, credits, loading, refreshProfile };
}
