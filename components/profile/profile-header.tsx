"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Camera, LogOut, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ProfileHeaderProps {
    user: User;
    profile: {
        avatar_url: string | null;
        credits: number;
        // Add other fields if needed
    } | null;
}

export function ProfileHeader({ user, profile }: ProfileHeaderProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Safe client for interactions
    let supabase: any = null;
    try { supabase = createClient(); } catch (e) { }

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
            router.refresh();
            router.push("/");
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !supabase) return;

        const file = e.target.files[0];
        setLoading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                });

            if (updateError) throw updateError;

            toast.success("Profile picture updated!");
            router.refresh(); // Refresh server data to show new image

        } catch (error: any) {
            toast.error("Failed to upload: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center space-y-4 mb-8">
            {/* Avatar Circle */}
            <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-lg bg-muted relative">
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-4xl font-bold">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="animate-spin text-white w-8 h-8" />
                        </div>
                    )}
                </div>

                {/* Edit Button Overlay */}
                <label className={`${loading ? 'hidden' : 'flex'} absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-100 transition-colors`}>
                    <Camera className="w-5 h-5 text-gray-700" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={loading} />
                </label>
            </div>

            {/* Info */}
            <div className="text-center">
                <h1 className="text-2xl font-bold">{user.email}</h1>
                <div className="text-muted-foreground text-sm mt-1">
                    Member since {new Date(user.created_at).getFullYear()}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            </div>

            {/* Stats Card */}
            <div className="mt-4 bg-muted/50 rounded-xl p-4 w-full max-w-xs text-center border">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Credits</div>
                <div className="text-3xl font-bold text-primary mt-1">
                    {profile?.credits ?? 0}
                </div>
            </div>
        </div>
    );
}
