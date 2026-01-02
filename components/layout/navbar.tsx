"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthModal } from "@/components/auth/auth-modal";
import { useUserProfile } from "@/hooks/use-user-profile";

// Using the static file in public/logo.png
const logo = "/logo.png";
import { Zap } from "lucide-react";

interface NavbarProps {
    user: User | null;
}

export function Navbar({ user: initialUser }: NavbarProps) {
    const pathname = usePathname();
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    // Listen for custom login event
    React.useEffect(() => {
        const handleOpenLogin = () => setIsLoginOpen(true);
        window.addEventListener('open-login', handleOpenLogin);
        return () => window.removeEventListener('open-login', handleOpenLogin);
    }, []);

    // Use the hook for real-time updates, fallback to server prop for initial state
    const { user: clientUser, avatarUrl, credits } = useUserProfile();
    const currentUser = clientUser || initialUser;

    const getLinkClass = (path: string) => {
        const isActive = pathname === path;
        return cn(
            "px-5 py-2 text-sm font-medium rounded-full transition-all",
            isActive
                ? "bg-white text-black shadow-sm"
                : "text-gray-400 hover:text-white"
        );
    };

    return (
        <>
            <div className="fixed top-6 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 pointer-events-none">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 pointer-events-auto">
                    <Image src={logo} alt="FaceAI Logo" width={32} height={32} className="w-8 h-8 object-contain" />
                    <span className="text-white font-bold text-lg tracking-tight">Stylens</span>
                </Link>

                {/* Center Navigation - Floating Island */}
                <nav className="hidden md:flex items-center bg-[#1A1A1A] p-1.5 rounded-full border border-white/5 shadow-xl pointer-events-auto absolute left-1/2 -translate-x-1/2">
                    <Link href="/" className={getLinkClass("/")}>
                        Gallery
                    </Link>
                    <Link href="/archive" className={getLinkClass("/archive")}>
                        My Archive
                    </Link>
                    <Link href="/pricing" className={getLinkClass("/pricing")}>
                        Pricing
                    </Link>

                </nav>

                {/* Right Side Buttons */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    {currentUser ? (
                        <>
                            {/* Credits Display */}
                            <Link href="/pricing">
                                <Button
                                    variant="ghost"
                                    className="hidden md:flex items-center gap-2 bg-zinc-900/50 hover:bg-zinc-800 text-white border border-white/5 rounded-full px-4"
                                >
                                    <span className="font-semibold tabular-nums">{credits || 0}</span>
                                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                </Button>
                            </Link>

                            <Link href="/profile">
                                <Avatar className="h-10 w-10 border border-zinc-700 overflow-hidden">
                                    <AvatarImage className="object-cover" src={avatarUrl || currentUser.user_metadata?.avatar_url || undefined} />
                                    <AvatarFallback className="bg-zinc-800 text-white">
                                        {currentUser.email?.charAt(0).toUpperCase() || "U"}
                                    </AvatarFallback>
                                </Avatar>
                            </Link>
                        </>
                    ) : (
                        <Button
                            onClick={() => setIsLoginOpen(true)}
                            className="bg-white text-black hover:bg-gray-200 rounded-full px-6 h-10 text-sm font-medium border-0"
                        >
                            Log in
                        </Button>
                    )}
                </div>
            </div>

            <AuthModal
                open={isLoginOpen}
                onOpenChange={setIsLoginOpen}
            />
        </>
    );
}
