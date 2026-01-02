import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ArchiveFeed } from "@/components/archive/archive-feed";

export default async function ArchivePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="min-h-screen font-sans pt-32 flex flex-col items-center justify-center text-center px-4">
                <div className="max-w-md space-y-6">
                    <h1 className="text-3xl font-bold text-white">My Archive</h1>
                    <p className="text-zinc-400">
                        Log in to view your history of generated styles and avatars.
                        Your creative journey is saved securely.
                    </p>
                    {/* We can't use the custom event directly in a Server Component easily for interactivity without a Client Component wrapper,
                       BUT we can use a small client component or just simple script? 
                       Actually, the cleanest is to make a small client component for the button.
                       OR, I can make this whole page section a client component?
                       
                       Let's keep it simple: Make a `GuestArchiveState` component inline or imported?
                       Let's simple use a client component trigger.
                    */}
                    <LoginTriggerButton />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans pt-24">
            <ArchiveFeed userEmail={user.email!} userId={user.id} />
        </div>
    );
}

// Simple Client Component for the button
import { LoginTriggerButton } from "@/components/auth/login-trigger-button";
