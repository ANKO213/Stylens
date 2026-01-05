"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

interface TutorialStepProps {
    onComplete: () => void;
}

export function TutorialStep({ onComplete }: TutorialStepProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [progress, setProgress] = useState(0);

    // Auto-play on mount
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {
                // Autoplay blocked
                console.log("Autoplay blocked");
            });
            setIsPlaying(true);
        }
    }, []);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(progress);
        }
    };

    return (
        <div className="flex flex-col h-full w-full max-w-md mx-auto bg-black text-white relative overflow-hidden rounded-3xl">
            {/* Video Container */}
            <div
                className="relative flex-1 bg-zinc-900 cursor-pointer group"
                onClick={togglePlay}
            >
                <video
                    ref={videoRef}
                    src="/videos/tutorial.mp4"
                    className="w-full h-full object-cover"
                    playsInline
                    loop
                    muted={isMuted}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={onComplete} // Optional: auto-advance
                />

                {/* Play/Pause Overlay */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
                            <Play className="w-8 h-8 text-white fill-white ml-1" />
                        </div>
                    </div>
                )}

                {/* Mute Button */}
                <button
                    onClick={toggleMute}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 transition-colors z-10"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <motion.div
                        className="h-full bg-white"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Bottom Content */}
            <div className="p-6 bg-[#121212] flex flex-col gap-4">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Watch this quick tutorial to get the best results. Upload a clear selfie for the best AI generation.
                    </p>
                </div>

                <Button
                    onClick={onComplete}
                    className="w-full h-12 rounded-xl bg-white text-black hover:bg-zinc-200 font-semibold text-base transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                    Continue to Upload <ArrowRight size={18} />
                </Button>
            </div>
        </div>
    );
}
