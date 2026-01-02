import { PricingTable } from "@/components/pricing-table";

export default function PricingPage() {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center overflow-hidden pt-20">
            <div className="text-center mb-12 space-y-3 shrink-0">
                <div className="flex flex-col items-center justify-center gap-2">
                    <p className="font-[300] text-[40px] md:text-[60px] leading-none text-white tracking-[2px] uppercase font-sans">
                        AI STUDIO
                    </p>
                    <p className="font-bold text-[40px] md:text-[60px] leading-none text-white tracking-[1.5px] uppercase font-sans">
                        Choose Your Plan
                    </p>
                </div>
                <p className="text-white/40 uppercase tracking-widest text-xs font-medium pt-4">
                    Unlock your creative potential
                </p>
            </div>
            <div className="w-full max-w-[1400px] px-4 shrink-0">
                <PricingTable />
            </div>
        </div>
    );
}
