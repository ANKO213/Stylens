"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Download, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming cn is available
import { toast } from "sonner"; // Assuming toast is available
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
    onShare?: () => void;
}

export function PhotoDetailModal({ open, onOpenChange, image, onShare }: PhotoDetailModalProps) {
    const router = useRouter();

    if (!open || !image) return null;

    const handleDownload = async () => {
        if (!image.url) return;

        // Generate a nice filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `stylens-${image.title || 'archived'}-${date}.png`;

        // Use proxy to bypass CORS and force download
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
        // Prepare query params for the generation studio
        // If we have a prompt, pass it. If not, maybe pass the image as reference?
        // For now, let's just go to home with the image as a reference if possible, or just open the create modal.
        // Since we are in the archive, we might not have easy access to the exact 'pin' logic.
        // Simplest 'Regenerate' is to try and re-run the prompt.

        // As a fallback/placeholder behavior:
        onOpenChange(false);
        toast.info("Opening Studio...");
        // Redirect to home with query param? Or imply user opens the "Create" button manually?
        // Better: trigger the global create modal? (That might be hard from here without context).
        // Let's just emulate "Use as Reference" or similar.

        // Actually, user asked for "Regenerate" button next to "Download".
        // Let's make it redirect to Home with `?regenerate=${image.id}` or similar if we were fancy.
        // For now, let's just make it redirect to home so they can generate.
        router.push("/");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => onOpenChange(false)}>
            <div className="w-full max-w-[398px] md:scale-125 transition-transform" onClick={(e) => e.stopPropagation()}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
                    className="relative w-full aspect-[3/4] bg-[#121212] overflow-hidden rounded-[40px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.1)] flex flex-col"
                >
                    {/* Header Controls */}
                    <div className="absolute top-0 left-0 right-0 h-20 z-20 flex items-start justify-between p-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                        {/* Share (Top Left) */}
                        <button
                            onClick={onShare}
                            className="pointer-events-auto size-[40px] bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <Share2 className="size-5 text-white" strokeWidth={1.5} />
                        </button>

                        {/* Close (Top Right) */}
                        <button
                            onClick={() => onOpenChange(false)}
                            className="pointer-events-auto size-[40px] bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <X className="size-5 text-white" strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Main Image */}
                    <div className="flex-1 relative w-full h-full bg-[#18181b]">
                        <img
                            src={image.url}
                            alt={image.title}
                            className="w-full h-full object-cover"
                        />
                        {/* Title Overlay (Bottom of image) */}
                        <div className="absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                            <h3 className="text-white font-bold text-xl tracking-wide uppercase line-clamp-1">{image.title}</h3>
                            {image.prompt && (
                                <p className="text-white/60 text-xs mt-1 line-clamp-2 leading-relaxed">{image.prompt}</p>
                            )}
                        </div>
                    </div>

                    {/* Floating Text Indicator (Optional, like GenerationModal "Complete") */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        {/* Optional Title/Status could go here */}
                    </div>

                    {/* Bottom Actions Floating Bar */}
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-3 z-30">
                        {/* Download (Primary) */}
                        <button
                            onClick={handleDownload}
                            className="h-[44px] px-6 bg-white text-black font-bold rounded-full flex items-center gap-2 shadow-lg hover:bg-zinc-200 transition-transform active:scale-95"
                        >
                            <Download className="size-4" />
                            <span className="uppercase tracking-wider text-xs">Download</span>
                        </button>

                        {/* Regenerate (Secondary) */}
                        {/* 
                            For now, this button effectively just restarts the flow or goes to home. 
                            Since we don't have the "pin" object fully reconstructed in this context usually, 
                            we might just label it "Create Similar" or similar logic in future.
                        */}
                        <button
                            onClick={handleRegenerate}
                            className="size-[44px] bg-black/60 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-black/80 transition-transform active:scale-95 group"
                            title="Regenerate"
                        >
                            <RotateCcw className="size-4 group-hover:-rotate-180 transition-transform duration-500" />
                        </button>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
