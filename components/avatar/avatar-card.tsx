"use client";

import { motion } from "framer-motion";
import { AvatarMetadata, setMainAvatar, deleteAvatar } from "@/app/actions/avatar-storage";
import { User2, Trash2, CheckCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AvatarVisualizer } from "./avatar-visualizer";

interface AvatarCardProps {
    avatar: AvatarMetadata;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

export function AvatarCard({ avatar, isSelected, onToggleSelect }: AvatarCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSettingMain, setIsSettingMain] = useState(false);

    const handleSetMain = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSettingMain(true);
        try {
            await setMainAvatar(avatar.id);
            toast.success("Main avatar updated");
            router.refresh();
        } catch (error) {
            toast.error("Failed to update main avatar");
        } finally {
            setIsSettingMain(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this avatar?")) return;

        setIsDeleting(true);
        try {
            await deleteAvatar(avatar.id);
            toast.success("Avatar deleted");
            router.refresh();
        } catch (error) {
            toast.error("Failed to delete avatar");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            onClick={onToggleSelect}
            className={cn(
                "group relative rounded-3xl overflow-hidden border-2 transition-all cursor-pointer bg-zinc-900/50 aspect-[3/4] flex flex-col",
                isSelected ? "border-blue-500 shadow-[0_0_30px_-10px_rgba(59,130,246,0.5)]" : "border-zinc-800 hover:border-zinc-700"
            )}
        >
            {/* Status indicators */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                {avatar.isMain && (
                    <div className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <Star className="w-3 h-3 fill-white" /> Main
                    </div>
                )}
            </div>

            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handleDelete}
                    disabled={isDeleting}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Visualizer Preview (Static-ish) */}
            <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-zinc-800/50 to-transparent">
                <div className="absolute inset-0 flex items-end justify-center pb-8 scale-75 origin-bottom">
                    <AvatarVisualizer
                        gender={avatar.gender}
                        heightCm={avatar.heightCm}
                        weightKg={avatar.weightKg}
                        bodyType={avatar.bodyType}
                        skinColor={avatar.skinColor}

                    />
                </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-900">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-white truncate max-w-[120px]">{avatar.name}</h3>
                        <p className="text-xs text-zinc-500 capitalize">{avatar.gender} • {avatar.age}yo</p>
                    </div>

                    {!avatar.isMain && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10"
                            onClick={handleSetMain}
                            disabled={isSettingMain}
                        >
                            Set Main
                        </Button>
                    )}
                </div>
            </div>

            {/* Selection Overlay */}
            {isSelected && (
                <div className="absolute inset-0 border-4 border-blue-500 rounded-3xl pointer-events-none flex items-center justify-center bg-blue-500/10">
                    <div className="bg-blue-500 rounded-full p-2">
                        <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                </div>
            )}
        </div>
    );
}
