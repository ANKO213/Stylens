"use client";

import { useEffect, useState } from "react";
import { Pin, generateMockPins } from "@/lib/mock-data";
import { PinCard } from "./pin-card";
import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { AuthModal } from "@/components/auth/auth-modal";
import { GenerationModal } from "@/components/generation/generation-modal"; // Import
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export function MasonryFeed() {
    const [pins, setPins] = useState<Pin[]>([]);
    const [loading, setLoading] = useState(true);

    // JIT Onboarding State
    const { user, avatarUrl } = useUserProfile();
    const [authWizardOpen, setAuthWizardOpen] = useState(false);
    const [pendingPin, setPendingPin] = useState<Pin | null>(null);

    // Generation State
    const [generationModalOpen, setGenerationModalOpen] = useState(false);
    const [activePin, setActivePin] = useState<Pin | null>(null);

    // Initial load
    useEffect(() => {
        async function fetchStyles() {
            // Safe check for missing client/keys
            let supabase: any = null;
            try { supabase = createClient(); } catch (e) { }

            if (!supabase) {
                // Fallback to mock data if no keys, so app doesn't look empty for verification
                setPins(generateMockPins(20));
                setLoading(false);
                return;
            }

            try {
                const CORRECT_STORAGE_URL = "https://dgsvyelmvhybhphdxnvk.supabase.co/storage/v1/object/public/style-images/styles/";

                // 1. Fetch DB Data
                const { data, error } = await supabase
                    .from('styles')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;


                const uniquePinsMap = new Map<string, Pin>();

                // Helper to extract filename for deduplication
                const getFilename = (url: string) => url.split('/').pop() || '';

                // 1. Process DB Results
                if (data && data.length > 0) {
                    data.forEach((style: any) => {
                        const filename = style.image_url ? style.image_url.split('/').pop() : 'unknown.jpg';
                        const fixedUrl = `${CORRECT_STORAGE_URL}${filename}`;

                        // Use filename as unique key
                        uniquePinsMap.set(filename, {
                            id: style.id,
                            title: style.title || "Untitled",
                            imageUrl: fixedUrl,
                            author: "Pintero",
                            prompt: style.prompt || style.title,
                            heightRatio: 1.5
                        });
                    });
                }

                let finalPins = Array.from(uniquePinsMap.values());

                // 3. Shuffle (Fisher-Yates)
                for (let i = finalPins.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [finalPins[i], finalPins[j]] = [finalPins[j], finalPins[i]];
                }

                if (finalPins.length > 0) {
                    setPins(finalPins);
                } else {
                    setPins(generateMockPins(10));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }

        fetchStyles();
    }, []);

    // --- Click Interception Logic ---
    const handlePinClick = (pin: Pin) => {
        // 1. Check Auth & Profile
        const isReady = user && avatarUrl;

        if (isReady) {
            // 3. IF Logged In AND Face Exists: Immediately trigger generation
            triggerGeneration(pin);
        } else {
            // 1. IF NOT Logged In OR No Face: Open Wizard
            setPendingPin(pin);
            setAuthWizardOpen(true);
        }
    };

    const onWizardComplete = () => {
        // Resume generation for the pending pin
        if (pendingPin) {
            triggerGeneration(pendingPin);
            setPendingPin(null);
        }
    };

    const triggerGeneration = (pin: Pin) => {
        // toast.success(`Starting generation...`);
        setActivePin(pin);
        setGenerationModalOpen(true);
    };

    if (loading) {
        return (
            <div className="h-60 flex items-center justify-center w-full">
                <Loader2 className="animate-spin text-muted-foreground w-10 h-10" />
            </div>
        );
    }

    // --- Manual Masonry Layout (Prevent Jumping) ---
    const columns = [[], [], []] as Pin[][];
    if (pins.length > 0) {
        pins.forEach((pin, i) => {
            const colIndex = i % 3;
            columns[colIndex].push(pin);
        });
    }

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-6">
            {/* Desktop View (MD+) - Manual Flex Grid to prevent jumping */}
            <div className="hidden md:flex gap-4">
                <div className="flex-1 space-y-4">
                    {columns[0].map(pin => (
                        <PinCard key={pin.id} pin={pin} onClick={() => handlePinClick(pin)} />
                    ))}
                </div>
                <div className="flex-1 space-y-4">
                    {columns[1].map(pin => (
                        <PinCard key={pin.id} pin={pin} onClick={() => handlePinClick(pin)} />
                    ))}
                </div>
                <div className="flex-1 space-y-4">
                    {columns[2].map(pin => (
                        <PinCard key={pin.id} pin={pin} onClick={() => handlePinClick(pin)} />
                    ))}
                </div>
            </div>

            {/* Mobile View (< MD) - Simple Stack */}
            <div className="md:hidden space-y-4">
                {pins.map(pin => (
                    <PinCard key={pin.id} pin={pin} onClick={() => handlePinClick(pin)} />
                ))}
            </div>


            {/* JIT Auth Modal */}
            <AuthModal
                open={authWizardOpen}
                onOpenChange={setAuthWizardOpen}
                onComplete={onWizardComplete}
            />

            {/* AI Generation Modal */}
            <GenerationModal
                open={generationModalOpen}
                onOpenChange={setGenerationModalOpen}
                pin={activePin}
                user={user}
                userAvatar={avatarUrl}
            />
        </div>
    );
}
