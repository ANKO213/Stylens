"use strict";
"use client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Facebook, Linkedin, MessageCircle, Send, Twitter, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pin } from "@/lib/mock-data";

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pin: Pin | null;
}

export function ShareModal({ open, onOpenChange, pin }: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [shareUrl, setShareUrl] = useState("");

    useEffect(() => {
        if (pin && typeof window !== 'undefined') {
            const slug = pin.title
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            setShareUrl(`${window.location.origin}/${slug}`);
        }
    }, [pin]);

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
            case "linkedin":
                url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                break;
        }
        window.open(url, '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-full bg-[#121212]/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-0 overflow-hidden shadow-2xl">
                <div className="relative p-6 pt-12 text-center space-y-2">
                    {/* Close Button - Custom Round */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <X size={14} className="text-white/70" />
                    </button>

                    <DialogTitle className="text-2xl font-bold text-white tracking-wide">
                        Share with Friends
                    </DialogTitle>
                    <p className="text-zinc-400 text-sm">
                        Inspire others with this aesthetic style.
                    </p>
                </div>

                <div className="px-6 pb-8 space-y-8">
                    {/* Copy Link Section */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">
                            Share link
                        </label>
                        <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-2xl p-2 pr-2.5 pl-4 group hover:border-white/10 transition-colors">
                            <span className="flex-1 text-sm text-zinc-300 truncate font-mono">
                                {shareUrl}
                            </span>
                            <Button
                                onClick={handleCopy}
                                size="sm"
                                className="h-9 px-4 rounded-xl bg-white text-black hover:bg-zinc-200 font-medium transition-all active:scale-95"
                            >
                                {copied ? "Copied" : <Copy size={14} />}
                            </Button>
                        </div>
                    </div>

                    {/* Social Icons */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">
                            Share to
                        </label>
                        <div className="flex items-center justify-center gap-4">
                            <SocialButton
                                icon={<Send size={20} className="-ml-0.5 mt-0.5" />}
                                color="bg-[#229ED9]"
                                onClick={() => handleSocialShare("telegram")}
                                label="Telegram"
                            />
                            <SocialButton
                                icon={<MessageCircle size={20} />}
                                color="bg-[#25D366]"
                                onClick={() => handleSocialShare("whatsapp")}
                                label="WhatsApp"
                            />
                            <SocialButton
                                icon={<Twitter size={20} />}
                                color="bg-black border border-white/10"
                                onClick={() => handleSocialShare("twitter")}
                                label="X"
                            />
                            <SocialButton
                                icon={<Facebook size={20} />}
                                color="bg-[#1877F2]"
                                onClick={() => handleSocialShare("facebook")}
                                label="Facebook"
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SocialButton({ icon, color, onClick, label }: { icon: React.ReactNode, color: string, onClick: () => void, label: string }) {
    return (
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-active:scale-95 ${color}`}>
                {icon}
            </div>
            <span className="text-[10px] uppercase font-medium tracking-wide text-zinc-500 group-hover:text-zinc-300 transition-colors">
                {label}
            </span>
        </div>
    );
}
