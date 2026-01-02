"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Facebook, Twitter, Linkedin, Link } from "lucide-react";
import { useState, useEffect } from "react";
import { Pin } from "@/lib/mock-data";
import { toast } from "sonner";

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pin: Pin | null;
}

export function ShareModal({ open, onOpenChange, pin }: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [shareUrl, setShareUrl] = useState("");

    useEffect(() => {
        if (pin && typeof window !== "undefined") {
            setShareUrl(`${window.location.origin}/?pid=${pin.id}`);
        }
    }, [pin, open]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("Link copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy link");
        }
    };

    const handleSocialShare = (platform: string) => {
        let url = "";
        const text = `Check out this style on Ultraviolet: ${pin?.title}`;
        
        switch (platform) {
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                break;
            case 'linkedin':
                url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                break;
        }

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    if (!pin) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#18181b] border-white/10 text-white p-0 overflow-hidden gap-0 rounded-3xl">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-medium text-center">Share with Friends</DialogTitle>
                </DialogHeader>

                <div className="p-6 pt-2 space-y-6">
                    {/* Preview (Optional) */}
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                         <div className="h-12 w-12 rounded-xl bg-gray-800 overflow-hidden relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pin.imageUrl} alt={pin.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="overflow-hidden">
                            <h4 className="font-medium truncate text-sm">{pin.title}</h4>
                            <p className="text-xs text-white/50 truncate">By {pin.author}</p>
                        </div>
                    </div>

                    {/* Copy Link Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-white/50 uppercase tracking-wider ml-1">Page Link</label>
                        <div className="relative">
                            <Input 
                                value={shareUrl} 
                                readOnly 
                                className="pr-12 bg-black/20 border-white/10 h-11 rounded-xl text-white/80 font-mono text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute right-1 top-1 h-9 w-9 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Social Icons */}
                    <div className="grid grid-cols-4 gap-2">
                        <Button variant="outline" className="h-12 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl gap-2 border-dashed" onClick={handleCopy}>
                            <Link className="h-4 w-4" />
                        </Button>
                         <Button variant="outline" className="h-12 border-white/10 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] border-transparent hover:border-[#1DA1F2]/50 rounded-xl" onClick={() => handleSocialShare('twitter')}>
                            <Twitter className="h-5 w-5" />
                        </Button>
                        <Button variant="outline" className="h-12 border-white/10 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border-transparent hover:border-[#1877F2]/50 rounded-xl" onClick={() => handleSocialShare('facebook')}>
                            <Facebook className="h-5 w-5" />
                        </Button>
                        <Button variant="outline" className="h-12 border-white/10 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] border-transparent hover:border-[#0A66C2]/50 rounded-xl" onClick={() => handleSocialShare('linkedin')}>
                            <Linkedin className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
