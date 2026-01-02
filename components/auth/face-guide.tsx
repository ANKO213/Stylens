import { Check } from "lucide-react";

export function FaceGuide() {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm text-white">Best Results Require a Good Selfie</h3>
            </div>

            <div className="flex gap-4">
                {/* Example Image */}
                <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                        <img
                            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop"
                            alt="Good selfie example"
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                        />
                    </div>
                </div>

                {/* Checklist */}
                <div className="space-y-2 text-xs text-white/60 pt-1">
                    <div className="flex items-start gap-2">
                        <div className="text-green-400 mt-0.5">
                            <Check className="w-3 h-3" />
                        </div>
                        <p>Good lighting (Natural is best)</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="text-green-400 mt-0.5">
                            <Check className="w-3 h-3" />
                        </div>
                        <p>Direct eye contact</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="text-green-400 mt-0.5">
                            <Check className="w-3 h-3" />
                        </div>
                        <p>No sunglasses or obstructions</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="text-green-400 mt-0.5">
                            <Check className="w-3 h-3" />
                        </div>
                        <p>Solo photo (Only you)</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
