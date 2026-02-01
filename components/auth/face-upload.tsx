"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    Check,
    X,
    Camera,
    Info,
    Loader2,
    CheckCircle,
    AlertCircle,
    Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as faceapi from "face-api.js";
import { toast } from "sonner";
import { QRBridge } from "@/components/smart-capture/qr-bridge";

// Example image
const EXAMPLE_IMAGE_URL = "/images/good-example.jpg";

interface FaceUploadProps {
    onUpload: (file: File) => Promise<void>;
    isLoading?: boolean;
    className?: string; // Kept for compatibility
    onClose?: () => void;
    customUploadHandler?: (files: { main: File; side1: File | null; side2: File | null }) => Promise<void>;
    simple?: boolean;
}

export function FaceUpload({ onUpload, isLoading = false, onClose, customUploadHandler, simple = false }: FaceUploadProps) {
    const [showQR, setShowQR] = useState(false);

    // We now manage 3 slots locally
    const [slots, setSlots] = useState<{
        main: { file: File | null; preview: string | null };
        side1: { file: File | null; preview: string | null };
        side2: { file: File | null; preview: string | null };
    }>({
        main: { file: null, preview: null },
        side1: { file: null, preview: null },
        side2: { file: null, preview: null },
    });

    const [activeSlot, setActiveSlot] = useState<"main" | "side1" | "side2" | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Status now tracks overall upload process
    const [uploadStatus, setUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [modelLoaded, setModelLoaded] = useState(false);

    // Initialize Face API
    useEffect(() => {
        let mounted = true;
        async function loadModels() {
            try {
                const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                if (mounted) setModelLoaded(true);
            } catch (error) {
                console.error("Failed to load face models:", error);
                toast.error("Validation engine failed to load. Please refresh.");
            }
        }
        loadModels();
        return () => { mounted = false; };
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0], activeSlot || 'main');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeSlot) {
            handleFile(e.target.files[0], activeSlot);
        }
    };

    const handleFile = (file: File, slot: "main" | "side1" | "side2") => {
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => {
                setSlots(prev => ({
                    ...prev,
                    [slot]: { file, preview: reader.result as string }
                }));
            };
            reader.readAsDataURL(file);
        } else {
            toast.error("Please upload an image file");
        }
    };

    const clearSlot = (slot: "main" | "side1" | "side2") => {
        setSlots(prev => ({
            ...prev,
            [slot]: { file: null, preview: null }
        }));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const validateFace = async (file: File): Promise<boolean> => {
        try {
            const img = await faceapi.bufferToImage(file);
            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());

            if (detections.length === 0) throw new Error("No face detected. Please try a clearer photo.");

            return true;
        } catch (error: any) {
            console.warn("Validation warning:", error.message);
            return true;
        }
    };

    // Auto-close success dialog
    useEffect(() => {
        if (uploadStatus === "success") {
            const timer = setTimeout(() => {
                if (slots.main.file) {
                    onUpload(slots.main.file);
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [uploadStatus, slots.main.file, onUpload]);


    const handleSave = async () => {
        // Must have at least main photo
        if (!slots.main.file) {
            toast.error("Main photo is required!");
            return;
        }

        if (!modelLoaded) {
            toast.error("Validator initializing...");
            return;
        }

        setUploadStatus("loading");

        // Validate Main Photo
        const isValid = await validateFace(slots.main.file);
        if (!isValid) {
            toast.error("Main photo verification failed. Not clear enough.");
            setUploadStatus("idle"); // Reset to idle so user can try again
            return;
        }

        try {
            // CUSTOM HANDLER PATH
            if (customUploadHandler) {
                await customUploadHandler({
                    main: slots.main.file,
                    side1: slots.side1.file,
                    side2: slots.side2.file
                });
                setUploadStatus("success");
                return;
            }

            // DEFAULT PROFILE UPLOAD PATH
            // Import actions
            const { getPresignedUrl } = await import("@/app/actions/get-presigned-url");
            const { confirmAvatarUpload } = await import("@/app/actions/upload-avatars");

            const uploadedKeys: string[] = [];
            const filesToUpload = [
                { file: slots.main.file, name: "main" },
                { file: slots.side1.file, name: "side1" },
                { file: slots.side2.file, name: "side2" }
            ].filter(item => item.file !== null) as { file: File, name: string }[];

            // 1. Upload Loop
            for (const { file, name } of filesToUpload) {
                // Get URL
                const presignResult = await getPresignedUrl(name, file.type);
                if (presignResult.error || !presignResult.url) {
                    throw new Error(presignResult.error || `Failed to get upload URL for ${name}`);
                }

                // Upload direct to R2
                const uploadRes = await fetch(presignResult.url, {
                    method: "PUT",
                    body: file,
                    headers: {
                        "Content-Type": file.type
                    }
                });

                if (!uploadRes.ok) {
                    throw new Error(`Failed to upload ${name} to storage.`);
                }

                if (presignResult.key) {
                    uploadedKeys.push(presignResult.key);
                }
            }

            // 2. Confirm & Cleanup
            const confirmResult = await confirmAvatarUpload(uploadedKeys);
            if (confirmResult.error) {
                throw new Error(confirmResult.error);
            }

            setUploadStatus("success");

        } catch (err: any) {
            console.error(err);
            setUploadStatus("idle");
            toast.error(err.message || "Failed to upload photos");
        }
    };

    // Helper to open file dialog for a specific slot
    const triggerSelect = (slot: "main" | "side1" | "side2") => {
        setActiveSlot(slot);
        setTimeout(() => fileInputRef.current?.click(), 0);
    };

    return (
        <div className={cn(
            "flex flex-col md:flex-row w-full bg-zinc-950 text-white rounded-[32px] overflow-hidden border border-zinc-800 shadow-2xl relative transition-all",
            simple ? "h-full" : "h-full md:h-[600px]"
        )}>
            {/* QR Bridge Overlay */}
            {showQR && (
                <QRBridge
                    onCancel={() => setShowQR(false)}
                    onCaptureComplete={(key) => {
                        setShowQR(false);
                        toast.success("Mobile capture received! (Demo Integration)", {
                            description: `Key: ${key.substring(0, 8)}...`
                        });
                        // ideally trigger next step or state update
                    }}
                />
            )}

            {/* Hidden Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
            />

            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 text-zinc-500 hover:text-white transition-colors duration-200 outline-none focus:outline-none bg-black/50 p-2 rounded-full backdrop-blur-md"
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            {/* Left Side - Guidelines - HIDDEN IF SIMPLE */}
            {!simple && (
                <div className="w-full md:w-4/12 bg-zinc-900/50 p-6 flex flex-col relative border-b md:border-b-0 md:border-r border-zinc-800">
                    <div className="mb-6">
                        <h2 className="text-xl font-medium tracking-tight mb-2 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-zinc-400" />
                            Scanning Guide
                        </h2>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            For best AI resemblance, we need your face from multiple angles.
                        </p>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="relative group rounded-xl overflow-hidden border border-zinc-700/50 shadow-lg aspect-[4/3]">
                            <img
                                src={EXAMPLE_IMAGE_URL}
                                alt="Good example"
                                className="w-full h-full object-cover opacity-60"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Reference</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <GuidelineItem icon={<Check className="w-3 h-3 text-black" />} text="Frontal view (Required)" isValid />
                            <GuidelineItem icon={<Check className="w-3 h-3 text-black" />} text="Left Profile (Optional)" isValid />
                            <GuidelineItem icon={<Check className="w-3 h-3 text-black" />} text="Right Profile (Optional)" isValid />
                        </div>
                    </div>
                </div>
            )}

            {/* Right Side - Upload Zones - FULL WIDTH IF SIMPLE */}
            <div className={cn("w-full p-6 bg-zinc-950 flex flex-col relative", simple ? "md:w-full" : "md:w-8/12")}>
                {/* Header for Simple Mode */}
                {simple ? (
                    <div className="mb-4 flex flex-col items-center justify-center text-center gap-3">
                        <div>
                            <h3 className="text-lg font-medium text-white">Upload Photos</h3>
                            <p className="text-sm text-zinc-500">Frontal face is required.</p>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowQR(true)}
                            className="bg-indigo-500/10 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20 hover:text-white rounded-full px-4"
                        >
                            <Smartphone className="w-4 h-4 mr-2" />
                            Scan with Phone
                        </Button>
                    </div>
                ) : (
                    <div className="mb-6">
                        <h3 className="text-2xl font-semibold mb-1 tracking-tight">Create your Digital Twin</h3>
                        <p className="text-zinc-400 text-sm">Upload your photos to train the AI model.</p>
                    </div>
                )}

                {/* Upload Slots Grid */}
                <div
                    className="flex-1 grid gap-4 grid-cols-1 md:grid-cols-2"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Main Slot */}
                    <div className="md:col-span-2 relative group">
                        <div
                            onClick={() => triggerSelect("main")}
                            className={cn(
                                "h-full w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden min-h-[200px]",
                                isDragging ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-600",
                                slots.main.preview && "border-solid border-zinc-700 p-0"
                            )}
                        >
                            {slots.main.preview ? (
                                <>
                                    <img src={slots.main.preview} className="w-full h-full object-cover opacity-80" />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); clearSlot('main'); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Camera className="w-6 h-6 text-zinc-400" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Frontal Face</span>
                                    <span className="text-xs text-zinc-600 mt-1">Drag & drop or click</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Side Slots (Optional) - Only show if not simple? Or always? Design says simple mode usually hides complexity but user requested "simple" mode in Wizard. Let's keep them small if possible. */}
                    {!simple && (
                        <>
                            <div className="relative group aspect-square">
                                <div
                                    onClick={() => triggerSelect("side1")}
                                    className={cn(
                                        "h-full w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden",
                                        slots.side1.preview ? "border-solid border-zinc-700 p-0" : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-600"
                                    )}
                                >
                                    {slots.side1.preview ? (
                                        <>
                                            <img src={slots.side1.preview} className="w-full h-full object-cover opacity-80" />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); clearSlot('side1'); }}
                                                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-zinc-500 text-center px-4">Left Profile<br />(Optional)</span>
                                    )}
                                </div>
                            </div>

                            <div className="relative group aspect-square">
                                <div
                                    onClick={() => triggerSelect("side2")}
                                    className={cn(
                                        "h-full w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden",
                                        slots.side2.preview ? "border-solid border-zinc-700 p-0" : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-600"
                                    )}
                                >
                                    {slots.side2.preview ? (
                                        <>
                                            <img src={slots.side2.preview} className="w-full h-full object-cover opacity-80" />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); clearSlot('side2'); }}
                                                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-zinc-500 text-center px-4">Right Profile<br />(Optional)</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer / Actions */}
                <div className="mt-6 flex justify-end">
                    {!simple && (
                        <Button
                            onClick={handleSave}
                            disabled={uploadStatus === "loading" || !slots.main.file}
                            className={cn(
                                "w-full md:w-auto bg-white text-black hover:bg-zinc-200 rounded-full px-8 transition-all",
                                uploadStatus === "loading" && "opacity-80"
                            )}
                        >
                            {uploadStatus === "loading" ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verification...</>
                            ) : uploadStatus === "success" ? (
                                <><CheckCircle className="w-4 h-4 mr-2" /> Uploaded!</>
                            ) : (
                                "Start Analysis"
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function GuidelineItem({ icon, text, isValid }: { icon: React.ReactNode, text: string, isValid?: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800/50">
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", isValid ? "bg-green-500" : "bg-zinc-800")}>
                {icon}
            </div>
            <span className="text-xs text-zinc-400 font-medium">{text}</span>
        </div>
    );
}
