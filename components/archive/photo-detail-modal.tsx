"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, RotateCcw, ArrowUpRight } from "lucide-react";
import { cn, generateStyleDeepLink } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PhotoDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    image: {
        id: string;
        url: string;
        title: string;
        prompt?: string;
    } | null;
    onShare?: (url?: string) => void;
}

export function PhotoDetailModal({ open, onOpenChange, image, onShare }: PhotoDetailModalProps) {
    const router = useRouter();

    if (!open || !image) return null;

    const handleDownload = async () => {
        if (!image.url) return;
        const date = new Date().toISOString().split('T')[0];
        const filename = `stylens-${image.title || 'archived'}-${date}.png`;
        const downloadUrl = `/api/download?url=${encodeURIComponent(image.url)}&filename=${encodeURIComponent(filename)}`;

        try {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Downloading...");
        } catch (e) {
            toast.error("Download failed");
        }
    };

    const handleRegenerate = () => {
        const prompt = image.prompt || image.title;
        const url = generateStyleDeepLink(prompt, image.title);
        router.push(url);
    };

    const handleShare = () => {
        if (!onShare) return;

        const prompt = image.prompt || image.title;
        const url = generateStyleDeepLink(prompt, image.title);

        onShare(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div
                className="w-full max-w-[398px] md:scale-125 transition-transform"
                onClick={(e) => e.stopPropagation()}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
                    className="relative w-full max-w-[398px] h-auto pb-[10px] overflow-hidden rounded-[40px] bg-[#121212] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.1)]"
                >
                    {/* Close Button (Top Right matching GenerationModal) */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute top-[32px] right-[24px] md:right-[32px] z-50 size-[40px] bg-[#e0e0e0] rounded-full flex items-center justify-center shadow-[0px_10px_15px_-3px_rgba(255,255,255,0.05),0px_4px_6px_-4px_rgba(255,255,255,0.05)] hover:scale-105 transition-transform"
                    >
                        <ArrowUpRight className="size-5 text-black" strokeWidth={1.7} />
                    </button>

                    {/* Header Text (Top Left matching GenerationModal) */}
                    <div className="absolute top-[18px] left-[24px] md:left-[32px] flex flex-col items-start z-10 w-[226px] p-[0px]">
                        <div className="h-[36px] flex items-start w-full relative shrink-0">
                            <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">AI Studio</p>
                        </div>
                        <div className="h-[36px] flex items-start w-full relative shrink-0">
                            <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans line-clamp-1">
                                {image.title || 'PORTRAIT'}
                            </p>
                        </div>
                    </div>

                    {/* Main Image Card matching GenerationModal */}
                    <div className="relative mt-[104px] mx-auto w-[calc(100%-20px)] aspect-[3/4] bg-[#18181b] rounded-[32px] border border-[rgba(255,255,255,0.05)] overflow-hidden shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">

                        {/* IMAGE CONTENT */}
                        <div className="absolute inset-0 z-0 text-center">
                            <img
                                src={image.url}
                                className="w-full h-full object-cover animate-in fade-in zoom-in duration-700"
                                alt={image.title}
                            />
                        </div>

                        {/* Floating Buttons */}
                        <div className="absolute bottom-[26px] w-full flex justify-center items-center gap-[8px] px-0 z-20">

                            {/* Main Action Button (Download) */}
                            <div
                                onClick={handleDownload}
                                className="relative h-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full flex items-center justify-center gap-3 px-5 transition-all duration-300 border border-[rgba(255,255,255,0.1)] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] select-none cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:scale-105"
                            >
                                <Download className="size-3.5 text-[#05DF72]" />
                                <span className="font-bold text-[11px] leading-[16.5px] tracking-[0.6px] uppercase text-white whitespace-nowrap">
                                    Download Image
                                </span>
                            </div>

                            {/* Regenerate Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegenerate();
                                }}
                                className="relative size-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full flex items-center justify-center border border-[rgba(255,255,255,0.1)] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors group/btn"
                                title="Regenerate"
                            >
                                <RotateCcw className="size-4 text-white group-hover/btn:-rotate-180 transition-transform duration-500" />
                            </button>

                            {/* Share Button (Added back for parity) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleShare();
                                }}
                                className="relative size-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full flex items-center justify-center border border-[rgba(255,255,255,0.1)] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors group/btn"
                                title="Share"
                            >
                                <Share2 className="size-4 text-white group-hover/btn:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
