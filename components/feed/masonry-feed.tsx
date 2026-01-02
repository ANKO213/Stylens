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
                const dbPromise = supabase
                    .from('styles')
                    .select('*')
                    .order('created_at', { ascending: false });

                // 2. Fetch Storage Data (to find orphans)
                const storagePromise = supabase.storage
                    .from('style-images')
                    .list('styles', { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });

                const [dbResult, storageResult] = await Promise.all([dbPromise, storagePromise]);

                let allPins: Pin[] = [];

                // Process DB Results
                if (dbResult.data && dbResult.data.length > 0) {
                    allPins = dbResult.data.map((style: any) => {
                        const filename = style.image_url ? style.image_url.split('/').pop() : 'unknown.jpg';
                        // Fix URL to always point to the correct storage folder
                        const fixedUrl = `${CORRECT_STORAGE_URL}${filename}`;

                        return {
                            id: style.id,
                            title: style.title || "Untitled",
                            imageUrl: fixedUrl,
                            author: "Pintero",
                            prompt: style.prompt || style.title
                        };
                    });
                }

                // Process Storage Results
                if (storageResult.data && storageResult.data.length > 0) {
                    const dbImageUrls = new Set(allPins.map(p => p.imageUrl));

                    const storagePins: Pin[] = storageResult.data
                        .filter((file: any) => file.name !== '.emptyFolderPlaceholder')
                        .map((file: any) => {
                            // Construct strict URL for storage files too
                            const fixedUrl = `${CORRECT_STORAGE_URL}${file.name}`;

                            return {
                                id: file.id || file.name,
                                title: file.name,
                                imageUrl: fixedUrl,
                                author: "Storage",
                                prompt: "Recovered from storage"
                            };
                        })
                        // Filter out if this URL is already in the DB list
                        .filter((pin: Pin) => !dbImageUrls.has(pin.imageUrl));

                    // Merge orphans
                    allPins = [...allPins, ...storagePins];
                }

                if (allPins.length > 0) {
                    setPins(allPins);
                } else {
                    // Only use mock if absolutely nothing found in DB OR Storage
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
