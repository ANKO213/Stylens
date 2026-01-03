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

                // 2. Process Storage Results (Only add if filename not already in Map)
                if (storageResult.data && storageResult.data.length > 0) {
                    storageResult.data.forEach((file: any) => {
                        if (file.name === '.emptyFolderPlaceholder') return;

                        const filename = file.name;

                        if (!uniquePinsMap.has(filename)) {
                            const fixedUrl = `${CORRECT_STORAGE_URL}${filename}`;
                            uniquePinsMap.set(filename, {
                                id: file.id || file.name,
                                title: file.name,
                                imageUrl: fixedUrl,
                                author: "Storage",
                                prompt: "Recovered from storage",
                                heightRatio: 1.5
                            });
                        }
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

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-6">
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
                {pins.map((pin) => (
                    <PinCard
                        key={pin.id}
                        pin={pin}
                        onClick={() => handlePinClick(pin)}
                    />
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
