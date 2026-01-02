"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Edit2,
    Share2,
    Settings,
    Grid,
    Archive,
    Users,
    Zap,
    Image as ImageIcon,
    Camera,
    Coins,
    LogOut,
    Check
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FaceUpload } from "@/components/auth/face-upload";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProfileDashboardProps {
    user: User;
    profile: any;
    stats: {
        joinedAt: string;
        credits: number;
    };
}

const MOCK_GALLERY = [
    { id: 1, url: "https://images.unsplash.com/photo-1762117666457-919e7345bd90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWx2ZXIlMjBsYXB0b3AlMjBvbiUyMHdoaXRlJTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NjY3ODUxNjd8MA&ixlib=rb-4.1.0&q=80&w=1080", title: "Laptop Concept 1" },
    { id: 2, url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 2" },
    { id: 3, url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 3" },
    { id: 4, url: "https://images.unsplash.com/photo-1541807084-5c52b6b3bd99?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 4" },
    { id: 5, url: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 5" },
    { id: 6, url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 6" },
];

export function ProfileDashboard({ user, profile, stats }: ProfileDashboardProps) {
    const router = useRouter();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleSignOut = async () => {
        setIsLoading(true);
        try {
            await supabase.auth.signOut();
            router.push("/"); // Redirect to home
            router.refresh();
            toast.success("Logged out successfully");
        } catch (error) {
            toast.error("Error logging out");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-700">
            {/* Container */}
            <div className="w-full mx-auto px-4 md:px-8 pb-20">

                {/* Banner Section */}
                <div className="relative group">
                    <div className="h-64 md:h-80 w-full bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-[2rem] overflow-hidden relative">
                        {/* Banner overlay gradient */}
                        <div className="absolute inset-0 bg-black/20" />
                    </div>

                    {/* Profile Picture Section - Overlapping */}
                    <div className="absolute -bottom-16 left-8 md:left-12">
                        <div className="relative group/avatar">
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-zinc-800 rounded-3xl border-4 border-[#09090b] shadow-xl overflow-hidden flex items-center justify-center">
                                {/* Real Avatar */}
                                <Avatar className="w-full h-full rounded-none">
                                    <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="w-full h-full flex items-center justify-center bg-zinc-700/50 text-zinc-500 rounded-none">
                                        <Camera className="w-12 h-12 opacity-50" />
                                    </AvatarFallback>
                                </Avatar>

                                {/* Set Profile Image Button Overlay */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="rounded-full text-xs bg-zinc-800/90 text-zinc-200 border border-zinc-600"
                                        onClick={() => setIsEditOpen(true)}
                                    >
                                        Set Profile Image
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal for Face Upload */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent hideClose className="sm:max-w-[900px] p-0 overflow-hidden bg-transparent border-none shadow-none text-left">
                        <DialogTitle className="sr-only">Update Profile Photo</DialogTitle>
                        <FaceUpload
                            onUpload={async () => {
                                setIsLoading(true);
                                try {
                                    // Upload is handled by FaceUpload component internal server action
                                    router.refresh();
                                    toast.success("Avatar updated!");
                                    setIsEditOpen(false);
                                } catch (err: any) {
                                    toast.error("Failed to refresh profile");
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            isLoading={isLoading}
                            onClose={() => setIsEditOpen(false)}
                        />
                    </DialogContent>
                </Dialog>

                {/* User Info Section */}
                <div className="mt-20 px-8 md:px-12 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="flex-1 space-y-2">
                        {/* Email / Name */}
                        <div className="flex items-center gap-3 group">
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                                {user.email}
                            </h1>
                        </div>

                        {/* Joined Date */}
                        <div className="text-zinc-500 font-medium text-sm">
                            Joined {new Date(stats.joinedAt).toLocaleDateString("en-US", { month: 'long', year: 'numeric' })}
                        </div>
                    </div>

                    {/* Actions & Credits */}
                    <div className="flex flex-col items-start md:items-end gap-4">

                        {/* Credits Block */}
                        <div className="w-full md:w-auto bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Zap className="w-5 h-5 fill-amber-500" />
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Credits</div>
                                <div className="text-xl font-bold text-white tabular-nums">{stats.credits}</div>
                            </div>
                            <Link href="/pricing" passHref>
                                <Button size="sm" variant="outline" className="ml-auto md:ml-2 bg-transparent border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 h-8 text-xs">
                                    Buy More
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="mt-12 px-8 md:px-12">
                    <div className="flex items-center gap-8 border-b border-zinc-800 pb-1">
                        <div className="text-sm font-medium text-white pb-3 border-b-2 border-white">
                            Archive
                        </div>

                        <div className="ml-auto pb-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSignOut}
                                disabled={isLoading}
                                className="text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Log out
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="mt-8 px-4 md:px-8">
                    {/* Real Gallery Fetching */}
                    <GalleryGrid userEmail={user.email} userId={user.id} />
                </div>
            </div>
        </div>
    );
}

// Subcomponent for handling async fetching efficiently
import { getUserGenerations } from "@/app/actions/gallery";

function GalleryGrid({ userEmail, userId }: { userEmail: string | undefined, userId: string }) {
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchImages() {
            setLoading(true);
            setError(null);
            try {
                const result = await getUserGenerations(userEmail, userId);

                if (result.success) {
                    setImages(result.images || []);
                } else {
                    setError(result.error || "Failed to load images");
                }
            } catch (e) {
                console.error(e);
                setError("Unexpected error loading gallery");
            } finally {
                setLoading(false);
            }
        }

        fetchImages();
    }, [userEmail, userId]);

    if (loading) {
        return <div className="text-zinc-500 text-sm">Loading gallery...</div>;
    }

    if (error) {
        return <div className="text-red-400 text-sm">Error: {error}</div>;
    }

    if (images.length === 0) {
        return <div className="text-zinc-500 text-sm">No generations yet. Start creating!</div>;
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
            {images.map((item) => (
                <div key={item.id} className="group relative aspect-square bg-white rounded-lg overflow-hidden border border-zinc-800 cursor-pointer">
                    <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center p-0">
                        <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

                    {/* Filename/Date Label on hover */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white truncate font-medium">{item.title}</p>
                    </div>

                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                        <div className="bg-zinc-900/80 backdrop-blur text-zinc-300 p-1.5 rounded hover:text-white hover:bg-black transition-colors" title="Download" onClick={() => window.open(item.url, '_blank')}>
                            <Share2 className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            ))}
        </motion.div>
    );
}

