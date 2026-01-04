"use client";

import { useState } from "react";
import Image from "next/image";
import { Pin } from "@/lib/mock-data";
import { Download, MoreHorizontal, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PinCardProps {
    pin: Pin;
    onClick?: () => void;
}

export function PinCard({ pin, onClick }: PinCardProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div
            className="mb-4 break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in"
            onClick={onClick}
        >
            {/* Image */}
            {/* Image */}
            <img
                src={pin.imageUrl}
                alt={pin.title}
                className="w-full h-auto object-cover rounded-2xl"
                loading="lazy"
                style={{ minHeight: '150px' }}
                onError={() => setIsVisible(false)}
            />

            {/* Overlay - Slightly less dark for visibility */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4 flex flex-col justify-between">

                {/* Top Right - Share Button */}
                <div className="flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // Create a friendly slug from title
                            const slug = pin.title
                                .toLowerCase()
                                .trim()
                                .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
                                .replace(/^-+|-+$/g, '');    // Trim leading/trailing hyphens

                            const url = `${window.location.origin}/${slug}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied to clipboard!");
                        }}
                        className="size-[40px] flex items-center justify-center bg-[rgba(26,26,26,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] rounded-full hover:bg-[rgba(255,255,255,0.1)] text-white/90 transition-colors duration-300 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)] active:scale-95"
                    >
                        <Share2 size={18} />
                    </button>
                </div>

                {/* Bottom Row */}
                <div className="flex justify-between items-center gap-2">
                    {/* Title Badge */}
                    <div
                        className="bg-[rgba(26,26,26,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] h-[40px] min-w-0 flex items-center justify-center rounded-full text-white/90 px-4 select-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="truncate text-[11px] font-bold uppercase tracking-wider max-w-[120px] text-center">{pin.title}</span>
                    </div>

                    {/* Action Buttons - Generate */}
                    <div className="flex gap-2">
                        <button className="h-[40px] bg-white rounded-full text-black font-bold text-[11px] uppercase tracking-widest px-5 flex items-center gap-2 hover:bg-white/90 transition-all duration-300 hover:scale-105 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
                            <span>Generate</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
