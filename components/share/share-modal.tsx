"use strict";
"use client";
import { Copy, Facebook, MessageCircle, Send, Twitter, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pin } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pin: Pin | null;
    url?: string; // Optional custom URL override
}

export function ShareModal({ open, onOpenChange, pin, url }: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [shareUrl, setShareUrl] = useState("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (url) {
                setShareUrl(url);
            } else if (pin) {
                const slug = pin.title
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                setShareUrl(`${window.location.origin}/${slug}`);
            }
        }
    }, [pin, url]);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success("Link copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSocialShare = (platform: string) => {
        if (!shareUrl) return;
        let url = "";
        const text = `Check out this AI style "${pin?.title}" on Stylens!`;

        switch (platform) {
            case "telegram":
                url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
                break;
            case "whatsapp":
                url = `https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`;
                break;
            case "twitter":
                url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
                break;
            case "facebook":
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                break;
        }
        window.open(url, '_blank');
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[398px] md:scale-125 transition-transform">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
                    className="relative w-full max-w-[398px] min-h-[400px] overflow-hidden rounded-[40px] bg-[#121212] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.1)] p-0"
                >
                    {/* Header Text */}
                    <div className="absolute top-[32px] left-[32px] flex flex-col items-start z-10 w-[226px]">
                        <div className="flex items-start w-full relative shrink-0">
                            <p className="font-[300] text-[30px] leading-[36px] text-white tracking-[1.9px] uppercase font-sans">Share with</p>
                        </div>
                        <div className="flex items-start w-full relative shrink-0">
                            <p className="font-bold text-[30px] leading-[36px] text-white tracking-[1.15px] uppercase font-sans">Friends</p>
                        </div>
                        <p className="mt-2 text-zinc-400 text-xs font-medium tracking-wide max-w-[200px] leading-relaxed">
                            Trading is more effective when you connect with friends!
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute top-[32px] right-[32px] z-50 size-[40px] bg-[#e0e0e0] rounded-full flex items-center justify-center shadow-[0px_10px_15px_-3px_rgba(255,255,255,0.05),0px_4px_6px_-4px_rgba(255,255,255,0.05)] hover:scale-105 transition-transform"
                    >
                        <ArrowUpRight className="size-5 text-black" strokeWidth={1.7} />
                    </button>

                    {/* Main Content Area - Matching standard card look */}
                    <div className="relative mt-[160px] mx-6 mb-8 bg-[#18181b] rounded-[32px] border border-[rgba(255,255,255,0.05)] overflow-hidden shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-6 space-y-8">

                        {/* Copy Link Section */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">
                                Share link
                            </label>
                            <div
                                onClick={handleCopy}
                                className="group flex items-center gap-2 bg-[#0a0a0a] border border-white/5 rounded-2xl p-1.5 pl-4 cursor-pointer hover:border-white/10 transition-colors"
                            >
                                <span className="flex-1 text-[13px] text-zinc-300 truncate font-mono select-all">
                                    {shareUrl}
                                </span>
                                <div className={cn(
                                    "h-9 px-4 rounded-xl flex items-center justify-center font-medium transition-all active:scale-95 text-xs",
                                    copied ? "bg-green-500/20 text-green-400" : "bg-white text-black hover:bg-zinc-200"
                                )}>
                                    {copied ? "Copied" : <Copy size={14} />}
                                </div>
                            </div>
                        </div>

                        {/* Social Icons */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">
                                Share to
                            </label>
                            <div className="flex items-center justify-between px-2">
                                <SocialButton
                                    icon={<Send size={18} className="-ml-0.5 mt-0.5" />}
                                    color="bg-[#229ED9]"
                                    onClick={() => handleSocialShare("telegram")}
                                    label="Telegram"
                                />
                                <SocialButton
                                    icon={<MessageCircle size={18} />}
                                    color="bg-[#25D366]"
                                    onClick={() => handleSocialShare("whatsapp")}
                                    label="WhatsApp"
                                />
                                <SocialButton
                                    icon={<Twitter size={18} />}
                                    color="bg-black border border-white/10"
                                    onClick={() => handleSocialShare("twitter")}
                                    label="X"
                                />
                                <SocialButton
                                    icon={<Facebook size={18} />}
                                    color="bg-[#1877F2]"
                                    onClick={() => handleSocialShare("facebook")}
                                    label="Facebook"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function SocialButton({ icon, color, onClick, label }: { icon: React.ReactNode, color: string, onClick: () => void, label: string }) {
    return (
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick}>
            <div className={`size-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-active:scale-95 ${color}`}>
                {icon}
            </div>
            <span className="text-[9px] uppercase font-bold tracking-wide text-zinc-600 group-hover:text-zinc-400 transition-colors">
                {label}
            </span>
        </div>
    );
}
