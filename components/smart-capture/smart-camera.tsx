"use client";

import { useEffect, useRef, useState } from "react";
import { FaceCaptureModule } from "@/lib/face-capture-module";
import { updateSessionStatus, getCaptureUploadUrl } from "@/app/actions/capture-session";
import { Loader2, Camera, User, Maximize2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SmartCameraProps {
    sessionId: string;
}

export function SmartCamera({ sessionId }: SmartCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const moduleRef = useRef<FaceCaptureModule | null>(null);

    const [status, setStatus] = useState<string>("Initializing...");
    const [qualityScore, setQualityScore] = useState(0);
    const [scale, setScale] = useState(1.0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captured, setCaptured] = useState(false);
    const [initializationError, setInitializationError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const init = async () => {
            // Notify desktop we are here
            await updateSessionStatus(sessionId, 'scanning');

            if (videoRef.current && canvasRef.current) {
                videoRef.current.width = 1920;
                videoRef.current.height = 1080;
                canvasRef.current.width = 1920;
                canvasRef.current.height = 1080;

                const mod = new FaceCaptureModule(videoRef.current, canvasRef.current);
                moduleRef.current = mod;

                mod.onFrameProcessed = (stats) => {
                    if (!active) return;
                    setStatus(stats.message);
                    setQualityScore(stats.score);
                    // Smooth smoothing for scale to prevent jitter
                    setScale(prev => prev * 0.9 + stats.scaleFactor * 0.1);
                };

                try {
                    await mod.start();
                } catch (e: any) {
                    console.error(e);
                    toast.error(e.message || "Camera access failed");
                    setStatus("Camera Error: " + (e.message || "Unknown error"));
                    setInitializationError(e.message || "Unknown error");
                }
            }
        };

        if (!active) return;
        init();

        return () => {
            active = false;
            moduleRef.current?.stop();
        };
    }, [sessionId]);

    if (initializationError) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                    <Camera className="w-8 h-8 text-red-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold mb-2 text-red-400">Camera Access Blocked</h2>
                    <p className="text-zinc-400 max-w-sm mx-auto text-sm leading-relaxed mb-4">
                        {initializationError}
                    </p>

                    <div className="bg-zinc-900 p-4 rounded-xl text-left text-xs text-zinc-500 space-y-2 max-w-sm mx-auto border border-zinc-800">
                        <p className="font-bold text-zinc-300">How to fix:</p>
                        <p>1. <strong>Use a Tunnel:</strong> Ask the developer to run a tunnel (ngrok/localtunnel) to get an HTTPS URL.</p>
                        <p>2. <strong>Use Localhost:</strong> This only works if the app is running on the device itself (Simulator).</p>
                        <p>3. <strong>Enable "Insecure Origins":</strong> (Advanced) Enable flags in chrome://flags for this IP.</p>
                    </div>
                </div>

                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm hover:bg-zinc-200 transaction-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const handleCapture = async () => {
        if (!moduleRef.current || isCapturing) return;
        setIsCapturing(true);

        try {
            // 1. Capture High Res
            const blob = await moduleRef.current.takePhoto();
            if (!blob) throw new Error("Capture failed");

            // 2. Get Presigned URL
            const { url, key } = await getCaptureUploadUrl(sessionId);

            // 3. Upload
            const uploadRes = await fetch(url, {
                method: "PUT",
                body: blob,
                headers: { "Content-Type": "image/png" }
            });

            if (!uploadRes.ok) throw new Error("Upload to cloud failed");

            // 4. Notify Desktop (with Full URL or just Key? Let's assume we construct URL or pass Key)
            // Ideally we pass a public URL or let desktop construct it. 
            // For R2 presigned usage in avatar-wizard, we usually use the Key. 
            // BUT wait, avatar-wizard expects files uploaded to specific slots? 
            // Actually avatar-wizard expects keys. 
            // Let's pass the KEY back in the status update.

            // Constructing a "virtual" URL for the session logic (or just passing key in a field)
            // We'll overload 'imageUrl' with the Key for now, or the desktop needs to know.
            await updateSessionStatus(sessionId, 'captured', key);

            setCaptured(true);
            setStatus("Photo sent to desktop!");
            toast.success("Success!");

        } catch (e) {
            console.error(e);
            toast.error("Capture failed");
            setIsCapturing(false);
        }
    };

    if (captured) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <div className="mb-6 w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Captured!</h2>
                <p className="text-zinc-400">Your photo has been sent to your desktop. You can close this tab.</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
            {/* The Camera Feed / Canvas */}
            {/* We apply the transform here to the container or canvas for the "Zoom" effect */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {/* Raw Video (Hidden) */}
                <video ref={videoRef} className="hidden" playsInline muted />

                {/* Processed Canvas with Zoom */}
                <div
                    className="relative w-full h-full transition-transform duration-200 ease-out will-change-transform flex items-center justify-center"
                    style={{
                        transform: `scale(${scale})`
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        className="object-cover h-full w-full"
                    />
                </div>

                {/* Overlays (Static, not zoomed) */}

                {/* Guidance Text */}
                <div className="absolute top-10 left-0 right-0 flex justify-center z-10 pointer-events-none">
                    <div className={cn(
                        "px-6 py-3 rounded-full backdrop-blur-md font-medium text-sm transition-colors shadow-xl border border-white/10",
                        qualityScore > 0.8 ? "bg-green-500/80 text-white" : "bg-black/60 text-white"
                    )}>
                        {status}
                    </div>
                </div>

                {/* Face Frame / Target */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                    <div className="w-[50vw] h-[65vw] border-2 border-white rounded-[40%] border-dashed" />
                </div>
            </div>

            {/* Controls */}
            <div className="h-40 bg-zinc-950 p-6 flex items-center justify-center relative z-20 border-t border-zinc-900">
                <button
                    onClick={handleCapture}
                    disabled={isCapturing || qualityScore < 0.5}
                    className={cn(
                        "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all shadow-lg",
                        qualityScore > 0.8
                            ? "border-white bg-white hover:scale-105" // Ready
                            : "border-zinc-700 bg-zinc-800 cursor-not-allowed opacity-50" // Not Ready
                    )}
                >
                    {isCapturing ? (
                        <Loader2 className="w-8 h-8 text-black animate-spin" />
                    ) : (
                        <div className={cn("w-16 h-16 rounded-full transition-colors", qualityScore > 0.8 ? "bg-white border-2 border-black" : "bg-zinc-600")} />
                    )}
                </button>
            </div>
        </div>
    );
}
