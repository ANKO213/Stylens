"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { useUserProfile } from "@/hooks/use-user-profile";
import { AuthModal } from "@/components/auth/auth-modal";

export function TopNav() {
    const { user, avatarUrl } = useUserProfile();
    const [authOpen, setAuthOpen] = useState(false);

    return (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-full border-b md:border-none transition-all duration-300">
            <div className="flex items-center gap-4 p-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search for styles..."
                        className="w-full h-12 pl-12 pr-4 rounded-full bg-muted/80 hover:bg-muted focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    />
                </div>

                {/* User Profile or Login Trigger */}
                {user ? (
                    <Link href="/profile" className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-border hover:opacity-80 transition-opacity bg-muted">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-lg bg-black text-white">
                                    {user.email?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </Link>
                ) : (
                    <button
                        onClick={() => setAuthOpen(true)}
                        className="flex-shrink-0 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold hover:opacity-90 transition-opacity"
                    >
                        Log in
                    </button>
                )}
            </div>

            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
        </div>
    );
}
