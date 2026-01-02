"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LoginForm } from "@/components/auth/login-form";
import { FaceUpload } from "@/components/auth/face-upload";
import { useUserProfile } from "@/hooks/use-user-profile";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";

interface AuthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: () => void; // Optional callback when "Ready" (Auth + Avatar done)
}

export function AuthModal({ open, onOpenChange, onComplete }: AuthModalProps) {
    const { user, avatarUrl, refreshProfile } = useUserProfile();
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    // Determine Step
    // 1. No User -> Auth
    // 2. User but No Avatar -> Upload
    // 3. Both -> Complete/Close
    const step = !user ? "auth" : (!avatarUrl ? "upload" : "complete");

    // Effect: Handle Completion
    useEffect(() => {
        if (open && step === "complete") {
            if (onComplete) {
                onComplete();
            }
            onOpenChange(false);
        }
    }, [open, step, onComplete, onOpenChange]);

    // Handle Upload Logic (Callback from FaceUpload)
    async function onUpload() {
        setLoading(true);
        try {
            // FaceUpload handles the actual upload via server action.
            // We just need to refresh the profile state here.
            await refreshProfile();
            toast.success("Selfie uploaded!");
        } catch (err: any) {
            toast.error("Failed to update profile state");
        } finally {
            setLoading(false);
        }
    }

    // Render nothing if complete (Dialog handles closing via effect, but good to be safe)
    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideClose={true}
                className={cn(
                    "p-0 overflow-hidden bg-transparent border-none shadow-none transition-all duration-300",
                    step === "upload" ? "sm:max-w-[900px]" : "sm:max-w-md"
                )}
            >
                <DialogTitle className="sr-only">Authentication</DialogTitle>

                {/* Custom Close Button for Auth Step (FaceUpload has its own) */}
                {step === "auth" && (
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute top-6 right-6 z-50 text-zinc-500 hover:text-white transition-colors duration-200 outline-none focus:outline-none bg-black/50 p-2 rounded-full backdrop-blur-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* AUTH STEP */}
                {step === "auth" && (
                    <div className="w-full">
                        <LoginForm />
                    </div>
                )}

                {/* UPLOAD STEP */}
                {step === "upload" && (
                    <div className="w-full">
                        <FaceUpload
                            onUpload={onUpload}
                            isLoading={loading}
                            onClose={() => onOpenChange(false)}
                        />
                    </div>
                )}

            </DialogContent>
        </Dialog >
    );
}
