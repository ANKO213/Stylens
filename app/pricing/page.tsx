import { PricingTable } from "@/components/pricing-table";

export default function PricingPage() {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center pt-32 pb-20 md:pt-20 md:pb-0 relative">
            <div className="text-center mb-12 space-y-3 shrink-0 px-6">
                <div className="flex flex-col items-center justify-center gap-2">
                    <p className="font-[300] text-[32px] md:text-[60px] leading-none text-white tracking-[2px] uppercase font-sans">
                        AI STUDIO
                    </p>
                    <p className="font-bold text-[32px] md:text-[60px] leading-none text-white tracking-[1.5px] uppercase font-sans">
                        Choose Your Plan
                    </p>
                </div>
                <p className="text-white/40 uppercase tracking-widest text-[10px] md:text-xs font-medium pt-4">
                    Unlock your creative potential
                </p>
            </div>
            <div className="w-full max-w-[1400px] px-4 md:px-6 shrink-0 mb-10 md:mb-0">
                <PricingTable />
            </div>
        </div>
    );
}
