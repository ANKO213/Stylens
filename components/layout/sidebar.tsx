"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Bell, MessageCircle, Settings, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchModal } from "@/components/search-modal";
import { useUserProfile } from "@/hooks/use-user-profile";
import { AuthModal } from "@/components/auth/auth-modal";

export function Sidebar() {
    const pathname = usePathname();
    const { user, avatarUrl } = useUserProfile();
    const [searchOpen, setSearchOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);

    const navItems = [
        { icon: Home, label: "Home", href: "/", action: null },
        { icon: LayoutGrid, label: "Categories", href: "#", action: () => setSearchOpen(true) },
        { icon: Plus, label: "Create", href: "/create", action: null },
        { icon: Bell, label: "Updates", href: "/updates", action: null },
        { icon: MessageCircle, label: "Inbox", href: "/inbox", action: null },
    ];

    const handleProfileClick = (e: React.MouseEvent) => {
        if (!user) {
            e.preventDefault();
            setAuthOpen(true);
        }
    };

    return (
        <>
            <div className="hidden md:flex fixed left-0 top-0 h-screen w-20 flex-col items-center justify-between py-6 border-r bg-background z-50">

                {/* Top Section: Logo + Nav */}
                <div className="flex flex-col items-center gap-6 w-full">
                    {/* Logo */}
                    <Link
                        href="/"
                        className="p-3 hover:bg-muted rounded-full transition-colors flex items-center justify-center"
                    >
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="h-8 w-8 object-contain"
                        />
                    </Link>

                    {/* Navigation Icons */}
                    <nav className="flex flex-col items-center gap-4 w-full">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href && item.href !== "#";
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        if (item.action) item.action();
                                    }}
                                    className={cn(
                                        "p-3 rounded-full transition-all duration-200 flex items-center justify-center relative group",
                                        isActive
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                    aria-label={item.label}
                                >
                                    {item.href !== "#" ? (
                                        <Link href={item.href} className="absolute inset-0" />
                                    ) : null}
                                    <item.icon className={cn("w-7 h-7", isActive && "fill-current")} strokeWidth={2.5} />
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Bottom Section: Settings / Profile */}
                <div className="flex flex-col items-center gap-4 w-full">
                    <Link
                        href={user ? "/profile" : "#"}
                        onClick={handleProfileClick}
                        className={cn(
                            "p-3 rounded-full transition-all duration-200 flex items-center justify-center",
                            pathname === "/profile"
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                        aria-label={user ? "Profile" : "Log In"}
                    >
                        {user ? (
                            avatarUrl ? (
                                <img src={avatarUrl} alt="Profile" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    {user.email?.charAt(0).toUpperCase()}
                                </div>
                            )
                        ) : (
                            <Settings className="w-7 h-7" strokeWidth={2.5} />
                        )}
                    </Link>
                </div>
            </div>

            {/* Modals */}
            <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
        </>
    );
}
