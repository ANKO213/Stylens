"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Sparkles, Loader2, Download, RotateCcw, ArrowUpRight, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pin } from "@/lib/mock-data";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Sample images fallback
const EXAMPLE_IMG = "https://images.unsplash.com/photo-1761429943531-49be6b2f8dfe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg";

type Step = 'upload' | 'scanning' | 'generating' | 'result';

interface GenerationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pin: Pin | null;
    user: User | null;
    userAvatar: string | null;
}

const LOADING_MESSAGES = [
    "Setting up studio...",
    "Polishing lenses...",
    "Adjusting lighting...",
    "Capturing subject...",
    "Developing film...",
    "Applying magic..."
];

export function GenerationModal({ open, onOpenChange, pin, user, userAvatar }: GenerationModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('upload');
    const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    // Reset state when modal opens/closes or pin changes
    useEffect(() => {
        if (open) {
            setStep('upload');
            setResultUrl(null);
        }
    }, [open, pin]);

    // Handle Animation Steps
    useEffect(() => {
        if (!open) return;

        if (step === 'scanning') {
            const timer = setTimeout(() => {
                setStep('generating');
                startGeneration(); // Actually trigger API when 'generating' starts (or before)
            }, 1500);
            return () => clearTimeout(timer);
        }

        if (step === 'generating') {
            let messageIndex = 0;
            setLoadingMessage(LOADING_MESSAGES[0]);

            const interval = setInterval(() => {
                messageIndex++;
                if (messageIndex < LOADING_MESSAGES.length) {
                    setLoadingMessage(LOADING_MESSAGES[messageIndex]);
                }
            }, 800);

            return () => clearInterval(interval);
        }
    }, [step, open]);

    async function startGeneration() {
        if (!pin || !user) return;

        try {
            // Construct potential side photo URLs based on the main R2 Avatar URL
            // Logic: userAvatar is like https://...r2.dev/avatars/email/main
            // We want .../avatars/email/side1 and .../side2

            let side1Url = "";
            let side2Url = "";
            const timestamp = new Date().getTime(); // Cache buster

            if (userAvatar && userAvatar.includes("avatars/")) {
                const baseUrl = userAvatar.substring(0, userAvatar.lastIndexOf('/')); // strip 'main' or filename
                side1Url = `${baseUrl}/side1?t=${timestamp}`;
                side2Url = `${baseUrl}/side2?t=${timestamp}`;
            } else {
                // Fallback for unexpected URL format (though clean slate should prevent this)
                // Should not happen if upload logic is correct.
                console.warn("Could not derive side URLs from avatar:", userAvatar);
            }

            const additionalFaces = [side1Url, side2Url].filter(u => !!u);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: pin.prompt,
                    faceUrl: userAvatar,
                    additionalFaceUrls: additionalFaces, // Send side photos
                    pinImage: pin.imageUrl,
                    title: pin.title,
                    model: "gemini-3-pro",
                    userId: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    toast.error("Insufficient credits! Redirecting...");
                    setTimeout(() => {
                        router.push("/pricing");
                        onOpenChange(false);
                    }, 1500);
                    return;
                }
                throw new Error(data.error || "Generation failed");
            }

            setResultUrl(data.imageUrl);
            setStep('result'); // Move to result only after success
            toast.success("Image generated successfully!");

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to generate image");
            setStep('upload'); // Reset on error
        }
    }

    const handleStartClick = () => {
        setStep('scanning');
    };

    const handleDownload = async () => {
        if (!resultUrl) return;
        try {
            // Toast loading state if needed, or just proceed
            const response = await fetch(resultUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            // Generate a nice filename
            const date = new Date().toISOString().split('T')[0];
            link.download = `stylens-${pin?.title || 'portrait'}-${date}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("Image saved to downloads");
        } catch (e) {
            console.error("Download error:", e);
            toast.error("Download failed, opening in new tab...");
            window.open(resultUrl, '_blank');
        }
    };

    if (!open) return null;

    const displayResultImage = resultUrl || pin?.imageUrl || EXAMPLE_IMG;
    const scanningImage = pin?.imageUrl || userAvatar || EXAMPLE_IMG;

    // Fallback for triggerImage is the Pin image
    const triggerImage = pin?.imageUrl;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-[398px] md:scale-125 transition-transform">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
                    className="relative w-full max-w-[398px] h-auto pb-[10px] overflow-hidden rounded-[40px] bg-[#121212] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.1)]"
                >
                    {/* Top Gradient */}


                    {/* Close Button */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute top-[32px] right-[24px] md:right-[32px] z-50 size-[40px] bg-[#e0e0e0] rounded-full flex items-center justify-center shadow-[0px_10px_15px_-3px_rgba(255,255,255,0.05),0px_4px_6px_-4px_rgba(255,255,255,0.05)] hover:scale-105 transition-transform"
                    >
                        <ArrowUpRight className="size-5 text-black" strokeWidth={1.7} />
                    </button>

                    {/* Header Text */}
                    <div className="absolute top-[18px] left-[24px] md:left-[32px] flex flex-col items-start z-10 w-[226px] p-[0px]">
                        <AnimatePresence mode="wait">
                            {step === 'upload' && (
                                <motion.div
                                    key="upload"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">AI Studio</p>
                                    </motion.div>
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans">Portrait</p>
                                    </motion.div>
                                </motion.div>
                            )}
                            {step === 'scanning' && (
                                <motion.div
                                    key="scanning"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">Scanning</p>
                                    </motion.div>
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans">Features</p>
                                    </motion.div>
                                </motion.div>
                            )}
                            {step === 'generating' && (
                                <motion.div
                                    key="generating"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">Creating</p>
                                    </motion.div>
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans">Artwork</p>
                                    </motion.div>
                                </motion.div>
                            )}
                            {step === 'result' && (
                                <motion.div
                                    key="result"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">Complete</p>
                                    </motion.div>
                                    <motion.div className="h-[36px] flex items-start w-full relative shrink-0">
                                        <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans">Masterpiece</p>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Main Image Card */}
                    <div className="relative mt-[104px] mx-auto w-[calc(100%-20px)] aspect-[3/4] bg-[#18181b] rounded-[32px] border border-[rgba(255,255,255,0.05)] overflow-hidden shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">

                        {/* IMAGE CONTENT */}
                        <div className="absolute inset-0 z-0">
                            {/* Upload/Ready State */}
                            {step === 'upload' && triggerImage && (
                                <div className="relative w-full h-full group">
                                    <img
                                        src={triggerImage}
                                        className="w-full h-full object-cover"
                                        alt="Source"
                                    />
                                    <div className="absolute inset-0 bg-black/20" />
                                </div>
                            )}

                            {/* Scanning/Generating State */}
                            {(step === 'scanning' || step === 'generating') && (
                                <>
                                    <img
                                        src={scanningImage}
                                        className={cn("w-full h-full object-cover transition-all duration-1000", step === 'generating' && "blur-sm scale-110 opacity-50")}
                                        alt="Processing"
                                    />
                                    {step === 'scanning' && (
                                        <motion.div
                                            initial={{ top: "-20%" }}
                                            animate={{ top: "120%" }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-white/20 to-transparent z-10"
                                        />
                                    )}
                                    {step === 'generating' && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                                className="w-[140%] h-[140%] bg-[conic-gradient(from_0deg,transparent_0_300deg,white_360deg)] opacity-10 blur-xl"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Result State */}
                            {step === 'result' && (
                                <img
                                    src={displayResultImage}
                                    className="w-full h-full object-cover animate-in fade-in zoom-in duration-700"
                                    alt="Result"
                                />
                            )}
                        </div>

                        {/* Floating Buttons */}
                        <div className="absolute bottom-[26px] w-full flex justify-center items-center gap-[8px] px-0 z-20">
                            {/* Main Action Button */}
                            <div
                                onClick={() => {
                                    if (step === 'upload') handleStartClick();
                                    if (step === 'result') handleDownload();
                                }}
                                className={cn(
                                    "relative h-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full flex items-center justify-center gap-3 px-5 transition-all duration-300 border border-[rgba(255,255,255,0.1)] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] select-none",
                                    step === 'upload' && "cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:scale-105",
                                    step === 'result' && "cursor-pointer hover:bg-[rgba(255,255,255,0.1)]"
                                )}
                            >
                                {step === 'upload' && <Sparkles className="size-3.5 text-yellow-400" />}
                                {step === 'scanning' && <ScanFace className="size-3.5 text-blue-400 animate-pulse" />}
                                {step === 'generating' && <Loader2 className="size-3.5 text-purple-400 animate-spin" />}
                                {step === 'result' && <Download className="size-3.5 text-[#05DF72]" />}

                                <span className="font-bold text-[11px] leading-[16.5px] tracking-[0.6px] uppercase text-white whitespace-nowrap">
                                    {step === 'upload' && "Generate • 100 Credits"}
                                    {step === 'scanning' && "Analyzing Face"}
                                    {step === 'generating' && loadingMessage}
                                    {step === 'result' && "Download Image"}
                                </span>
                            </div>

                            {/* Regenerate Button */}
                            {step === 'result' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStep('scanning'); // Restart
                                    }}
                                    className="relative size-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full flex items-center justify-center border border-[rgba(255,255,255,0.1)] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors group/btn"
                                >
                                    <RotateCcw className="size-4 text-white group-hover/btn:-rotate-180 transition-transform duration-500" />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
