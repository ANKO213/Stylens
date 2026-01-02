"use client";

import { useState } from "react";
import { STRIPE_PLANS } from "@/lib/stripe-config";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PricingTable() {
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

    const handleSubscribe = async (priceId: string) => {
        setLoadingPriceId(priceId);
        try {
            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceId })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to start checkout");
        } finally {
            setLoadingPriceId(null);
        }
    };

    return (
        <section className="py-0" id="pricing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
                {STRIPE_PLANS.map((plan) => (
                    <div
                        key={plan.id}
                        className={cn(
                            "relative flex flex-col p-0 bg-[#121212] rounded-[40px] border border-[rgba(255,255,255,0.05)] overflow-hidden transition-all duration-300",
                            "shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]",
                            plan.isPopular ? "scale-105 z-10 border-[rgba(255,255,255,0.15)] shadow-[0px_30px_60px_-15px_rgba(0,0,0,0.4)]" : "hover:border-[rgba(255,255,255,0.1)] hover:scale-[1.02]"
                        )}
                    >
                        {/* Plan Header Gradient/Image Placeholder */}
                        <div className="h-32 w-full bg-gradient-to-b from-white/5 to-transparent relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />

                            {plan.isPopular && (
                                <div className="absolute top-6 right-6">
                                    <span className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
                                        Popular
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="px-8 pb-8 flex-1 flex flex-col -mt-12 relative z-10">

                            {/* Plan Name & Price */}
                            <div className="mb-8">
                                <h3 className="font-[300] text-2xl text-white/60 tracking-[2px] uppercase mb-1">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[40px] font-bold text-white tracking-[1px] font-sans uppercase">${plan.price}</span>
                                    <span className="text-sm text-white/40 uppercase tracking-widest">/ mo</span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="w-full h-px bg-white/5 mb-8" />

                            {/* Features */}
                            <div className="flex-1 space-y-5 mb-10">
                                <div className="flex items-center gap-4 group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <Zap className={cn("w-4 h-4", plan.isPopular ? "text-amber-400" : "text-white/60")} />
                                    </div>
                                    <span className="text-sm font-medium text-white/90 tracking-wide uppercase">
                                        <span className="text-white font-bold">{plan.credits}</span> Credits / mo
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <Check className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                                    </div>
                                    <span className="text-sm text-white/60 tracking-wider">No daily limits</span>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <Check className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                                    </div>
                                    <span className="text-sm text-white/60 tracking-wider">Commercial usage</span>
                                </div>
                            </div>

                            {/* Floating Action Button */}
                            <div className="mt-auto">
                                <Button
                                    className={cn(
                                        "w-full h-[56px] rounded-full text-xs font-bold uppercase tracking-[1.5px] transition-all duration-300",
                                        "bg-[rgba(26,26,26,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.1)]",
                                        "shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1)]",
                                        "hover:bg-[rgba(255,255,255,0.15)] hover:scale-[1.02] hover:shadow-xl hover:border-white/20",
                                        "active:scale-95 text-white"
                                    )}
                                    onClick={() => handleSubscribe(plan.priceId)}
                                    disabled={!!loadingPriceId}
                                >
                                    {loadingPriceId === plan.priceId ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {plan.isPopular ? <Sparkles className="w-4 h-4 text-amber-300" /> : <Zap className="w-4 h-4 text-white/60" />}
                                            <span>Subscribe</span>
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
