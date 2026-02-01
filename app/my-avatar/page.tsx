"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarWizard } from "@/components/avatar/avatar-wizard";
import { AvatarCard } from "@/components/avatar/avatar-card";
import { getAvatars, AvatarMetadata } from "@/app/actions/avatar-storage";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function MyAvatarPage() {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [avatars, setAvatars] = useState<AvatarMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchAvatars = async () => {
        setIsLoading(true);
        const res = await getAvatars();
        if (res.avatars) {
            setAvatars(res.avatars);
        } else {
            // If error, might be empty or auth issue
            setAvatars([]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAvatars();
    }, []);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-700 pt-24 pb-20 px-4 md:px-12">

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">My Avatars</h1>
                        <p className="text-zinc-400 max-w-xl">
                            Create and manage digital twins for your AI generations. Select multiple avatars to generate group shots.
                        </p>
                    </div>

                    {!isCreating && (
                        <div className="flex gap-3">
                            {selectedIds.size > 0 && (
                                <Button variant="secondary" className="bg-zinc-800 text-white rounded-full">
                                    Generate with {selectedIds.size} Avatar{selectedIds.size > 1 ? 's' : ''}
                                </Button>
                            )}
                            <Button
                                onClick={() => setIsCreating(true)}
                                className="bg-white text-black hover:bg-zinc-200 rounded-full px-6"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Create New Avatar
                            </Button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {isCreating ? (
                        <motion.div
                            key="wizard"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        >
                            <AvatarWizard
                                onCancel={() => setIsCreating(false)}
                                onComplete={() => {
                                    setIsCreating(false);
                                    fetchAvatars(); // Refresh list
                                }}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="min-h-[400px]"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                                </div>
                            ) : avatars.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-96 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 text-center p-8">
                                    <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                                        <Users className="w-10 h-10 text-zinc-600" />
                                    </div>
                                    <h3 className="text-xl font-medium text-white mb-2">No Avatars Yet</h3>
                                    <p className="text-zinc-500 max-w-sm mb-8">
                                        Create your first digital avatar to start generating personalized AI photos.
                                    </p>
                                    <Button
                                        onClick={() => setIsCreating(true)}
                                        className="bg-white text-black hover:bg-zinc-200 rounded-full px-8"
                                    >
                                        Create Avatar
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {avatars.map(avatar => (
                                        <div key={avatar.id} onClick={() => toggleSelect(avatar.id)}>
                                            <AvatarCard
                                                avatar={avatar}
                                                isSelected={selectedIds.has(avatar.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
