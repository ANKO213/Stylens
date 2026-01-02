"use client";

import { useEffect, useState } from "react";
import { ArchiveCard } from "./archive-card";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ShareModal } from "@/components/share/share-modal";

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

import { getUserGenerations } from "@/app/actions/gallery";

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

    if (loading) {
        return (
            <div className="h-60 flex items-center justify-center w-full">
                <Loader2 className="animate-spin text-muted-foreground w-10 h-10" />
            </div>
        );
    }

    if (generations.length === 0) {
        return (
            <div className="h-60 flex items-center justify-center w-full">
                <p className="text-muted-foreground">No generations yet. Start creating!</p>
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
