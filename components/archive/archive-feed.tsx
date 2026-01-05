"use client";

import { useEffect, useState } from "react";
import { ArchiveCard } from "./archive-card";
import { Loader2, RefreshCw, Image as ImageIcon, Grid } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ShareModal } from "@/components/share/share-modal";
import { Button } from "@/components/ui/button";
import { syncUserGenerations } from "@/app/actions/sync-archive";
import { toast } from "sonner";
import { getUserGenerations } from "@/app/actions/gallery";

interface Generation {
    id: string;
    title: string;
    imageUrl: string;
    prompt?: string;
}

interface ArchiveFeedProps {
    userEmail: string;
    userId: string;
}

export function ArchiveFeed({ userEmail, userId }: ArchiveFeedProps) {
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareGeneration, setShareGeneration] = useState<Generation | null>(null);

    useEffect(() => {
        async function fetchGenerations() {
            setLoading(true);
            try {
                const result = await getUserGenerations(userEmail, userId);

                if (result.success && result.images) {
                    const mappedGenerations = result.images.map((img: any) => ({
                        id: img.id,
                        title: img.title || 'Untitled',
                        imageUrl: img.url,
                        prompt: '' // Storage doesn't store prompt metadata easily, so we leave it empty for now
                    }));
                    setGenerations(mappedGenerations);
                } else {
                    console.error("Error fetching generations:", result.error);
                    setGenerations([]);
                }
            } catch (e) {
                console.error(e);
                setGenerations([]);
            } finally {
                setLoading(false);
            }
        }

        fetchGenerations();
    }, [userEmail, userId]);

    const handleShareClick = (e: React.MouseEvent, generation: Generation) => {
        e.stopPropagation();
        setShareGeneration(generation);
        setShareModalOpen(true);
    };

    const handleSync = async () => {
        setLoading(true);
        try {
            const result = await syncUserGenerations();
            if (result.success) {
                toast.success(`Synced ${result.count || 0} images from storage.`);
                window.location.reload();
            } else {
                toast.error(result.error || "Sync failed");
                setLoading(false);
            }
        } catch (e) {
            toast.error("Sync error");
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-60 flex items-center justify-center w-full">
                <Loader2 className="animate-spin text-muted-foreground w-10 h-10" />
            </div>
        );
    }

    if (generations.length === 0) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                    <ImageIcon className="w-8 h-8 text-zinc-500" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-white">No generated photos yet</h3>
                    <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
                        You haven't generated any photos yet. Ready to create your first masterpiece?
                    </p>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                    <Button
                        variant="outline"
                        className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800 rounded-full px-8"
                        onClick={() => window.location.href = "/"}
                    >
                        <Grid className="w-4 h-4 mr-2" />
                        Go to Feed
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSync}
                        className="text-zinc-600 hover:text-zinc-400 text-xs h-auto py-1"
                    >
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        Missing images? Sync with Storage
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-6">
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
                {generations.map((generation) => (
                    <ArchiveCard
                        key={generation.id}
                        generation={generation}
                        onShare={(e) => handleShareClick(e, generation)}
                    />
                ))}
            </div>

            {/* Share Modal */}
            <ShareModal
                open={shareModalOpen}
                onOpenChange={setShareModalOpen}
                pin={shareGeneration ? {
                    id: shareGeneration.id,
                    title: shareGeneration.title,
                    imageUrl: shareGeneration.imageUrl,
                    author: "You",
                    prompt: shareGeneration.prompt || shareGeneration.title,
                    heightRatio: 1.0
                } : null}
            />
        </div>
    );
}
