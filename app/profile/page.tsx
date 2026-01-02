import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/");
    }

    // Fetch Profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // 2. Credits (Real Balance)
    const credits = profile?.credits || 0;

    const stats = {
        joinedAt: user.created_at || new Date().toISOString(),
        credits: credits
    };

    return (
        <ProfileDashboard
            user={user}
            profile={profile}
            stats={stats}
        />
    );
}
