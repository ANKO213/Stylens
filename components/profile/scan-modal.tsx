"use client";

import React from "react";
import { QRBridge } from "@/components/smart-capture/qr-bridge";
import { confirmAvatarUpload } from "@/app/actions/upload-avatars";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ScanModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
}

export function ScanModal({ open, onOpenChange, userId }: ScanModalProps) {
    const router = useRouter();

    const handleCapture = async (imageKey: string) => {
        try {
            toast.loading("Updating profile picture...", { id: "update-avatar" });

            // confirmAvatarUpload expects an array of keys
            const result = await confirmAvatarUpload([imageKey]);

            if (result.error) {
                toast.error(result.error, { id: "update-avatar" });
                return;
            }

            toast.success("Profile picture updated!", { id: "update-avatar" });
            onOpenChange(false);
            router.refresh();

        } catch (error) {
            console.error(error);
            toast.error("Failed to update profile", { id: "update-avatar" });
        }
    };

    if (!open) return null;

    return (
        <QRBridge
            onCancel={() => onOpenChange(false)}
            onCaptureComplete={handleCapture}
        />
    );
}
