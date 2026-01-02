import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AdminFeedTable } from "@/components/admin/admin-feed-table";

// Simple allowlist for the demo. In production, use database roles.
const ADMIN_EMAILS = ["admin@example.com", "demo@example.com"];

export default async function AdminFeedPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/login");
    }

    // Optional: Strict Admin Check
    // if (!ADMIN_EMAILS.includes(user.email || "")) {
    //    return redirect("/");
    // }

    const { data: styles, error } = await supabase
        .from("styles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch styles for admin:", error);
    }

    return (
        <div className="container py-10 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-[2px] text-white uppercase font-sans">Feed Management</h1>
                    <p className="text-zinc-400 mt-2 tracking-wide font-light">
                        Manage global feed content, prompts, and images.
                    </p>
                </div>
            </div>

            <AdminFeedTable initialStyles={styles || []} userEmail={user.email} />
        </div>
    );
}
