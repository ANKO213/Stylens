"use client";

import { Download, Share2 } from "lucide-react";

interface Generation {
    id: string;
    title: string;
    imageUrl: string;
    prompt?: string;
}

interface ArchiveCardProps {
    generation: Generation;
    onShare?: (e: React.MouseEvent) => void;
}

export function ArchiveCard({ generation, onShare }: ArchiveCardProps) {
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            const response = await fetch(generation.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${generation.title || 'generation'}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    return (
        <div className="mb-4 break-inside-avoid relative group rounded-2xl overflow-hidden">
            {/* Image */}
            <img
                src={generation.imageUrl}
                alt={generation.title}
                className="w-full h-auto object-cover rounded-2xl"
                loading="lazy"
                style={{ minHeight: '150px' }}
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4 flex flex-col justify-between">

                {/* Top Right - Share Button */}
                <div className="flex justify-end">
                    <button
                        className="size-[40px] flex items-center justify-center bg-[rgba(26,26,26,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] rounded-full hover:bg-[rgba(255,255,255,0.1)] text-white/90 transition-colors duration-300 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)]"
                        onClick={onShare}
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
                        <span className="truncate text-[11px] font-bold uppercase tracking-wider max-w-[120px] text-center">{generation.title}</span>
                    </div>

                    {/* Action Buttons - Download */}
                    <div className="flex gap-2">
                        <button
                            className="h-[40px] bg-white rounded-full text-black font-bold text-[11px] uppercase tracking-widest px-5 flex items-center gap-2 hover:bg-white/90 transition-all duration-300 hover:scale-105 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1)]"
                            onClick={handleDownload}
                        >
                            <Download size={14} />
                            <span>Download</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
