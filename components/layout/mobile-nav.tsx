"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
    const pathname = usePathname();

    const navItems = [
        { icon: Home, label: "Home", href: "/" },
        { icon: Search, label: "Search", href: "/search" },
        { icon: Plus, label: "Create", href: "/create" },
        { icon: MessageCircle, label: "Inbox", href: "/inbox" },
        { icon: User, label: "Profile", href: "/profile" },
    ];

    return (
        <div className="md:hidden fixed bottom-6 left-4 right-4 h-16 bg-white/60 backdrop-blur-md border border-white/20 shadow-lg rounded-full z-50 flex items-center justify-around px-2 supports-[backdrop-filter]:bg-white/60">
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "p-2.5 rounded-full transition-all duration-300 relative",
                            isActive
                                ? "bg-black text-white"
                                : "text-gray-500 hover:text-black hover:bg-black/5"
                        )}
                    >
                        <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                        {/* Active Dot indicator, optional */}
                        {/* {isActive && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-black rounded-full" />} */}
                    </Link>
                );
            })}
        </div>
    );
}
