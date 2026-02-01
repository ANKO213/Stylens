"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { FaceCaptureModule, FrameStats, TargetZone, Pose } from "@/lib/face-capture-module";
import { updateSessionStatus, getCaptureUploadUrl } from "@/app/actions/capture-session";
import { Loader2, Camera, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SmartCameraProps {
    sessionId: string;
}

// Visual configuration for the 5 zones
const ZONES: { id: TargetZone; label: string; angle: number }[] = [
    { id: 'left-profile', label: 'Left Profile', angle: 60 },
    { id: 'left-30', label: 'Left 3/4', angle: 30 },
    { id: 'center', label: 'Front', angle: 0 },
    { id: 'right-30', label: 'Right 3/4', angle: -30 },
    { id: 'right-profile', label: 'Right Profile', angle: -60 },
];

export function SmartCamera({ sessionId }: SmartCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const moduleRef = useRef<FaceCaptureModule | null>(null);

    const [status, setStatus] = useState<string>("Initializing...");
    const [qualityScore, setQualityScore] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [finished, setFinished] = useState(false);
    const [initializationError, setInitializationError] = useState<string | null>(null);

    // Multi-Angle State
    const [currentZone, setCurrentZone] = useState<TargetZone | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [pose, setPose] = useState<Pose>({ yaw: 0, pitch: 0, roll: 0 });
    const [stability, setStability] = useState(0);
    const [capturedZones, setCapturedZones] = useState<Set<TargetZone>>(new Set());
    const [captures, setCaptures] = useState<Map<TargetZone, Blob>>(new Map());

    // Initialize Camera
    useEffect(() => {
        let active = true;

        const init = async () => {
            // Notify desktop we are here
            await updateSessionStatus(sessionId, 'scanning');

            if (videoRef.current) {
                const video = videoRef.current;

                const startStream = async () => {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error(
                            "Camera access is not supported. Use HTTPS or localhost." +
                            (window.location.protocol === 'http:' ? " (Current: HTTP)" : "")
                        );
                    }

                    // Request 4K/High Res
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: "user",
                            width: { ideal: 3840 },
                            height: { ideal: 2160 }
                        }
                    });

                    video.srcObject = stream;
                    await video.play();

                    while (video.videoWidth === 0) {
                        await new Promise(r => requestAnimationFrame(r));
                    }

                    return { w: video.videoWidth, h: video.videoHeight };
                };

                try {
                    const dims = await startStream();

                    if (active && canvasRef.current) {
                        canvasRef.current.width = dims.w;
                        canvasRef.current.height = dims.h;

                        const mod = new FaceCaptureModule(videoRef.current, canvasRef.current);
                        moduleRef.current = mod;

                        mod.onFrameProcessed = (stats: FrameStats) => {
                            if (!active) return;
                            setStatus(stats.message);
                            setQualityScore(stats.score);
                            setCurrentZone(stats.currentZone);
                            setPose(stats.pose);
                            setStability(stats.progress);

                            // Auto-Capture Hook
                            if (stats.isStable && stats.currentZone && stats.score > 0.8) {
                                autoCapture(stats.currentZone);
                            }
                        };

                        await mod.start(true);
                    }
                } catch (e: any) {
                    console.error(e);
                    toast.error(e.message || "Camera failed");
                    setInitializationError(e.message);
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

    const autoCapture = async (zone: TargetZone) => {
        // Debounce / Check if already captured
        // We need to access the LATEST capturedZones. Use ref or functional update check?
        // Functional update isn't enough inside the closure unless we use a Ref.
        // Actually, onFrameProcessed captures state from init.
        // We need a Ref for claimed statuses to avoid closure staleness.
    };

    // Fix for closure staleness in onFrameProcessed:
    // We should use a Ref to track captured zones for the callback
    const capturedZonesRef = useRef<Set<TargetZone>>(new Set());

    const autoCaptureReal = async (zone: TargetZone) => {
        if (capturedZonesRef.current.has(zone) || isCapturing) return;

        // Optimistic Lock
        capturedZonesRef.current.add(zone); // Add to ref immediately
        setCapturedZones(new Set(capturedZonesRef.current)); // Update UI

        toast.success(`Captured ${zone.replace('-', ' ')}!`);

        if (moduleRef.current) {
            try {
                const blob = await moduleRef.current.takePhoto();
                if (blob) {
                    setCaptures(prev => new Map(prev).set(zone, blob));
                }
            } catch (e) {
                console.error("Capture failed", e);
                capturedZonesRef.current.delete(zone);
                setCapturedZones(new Set(capturedZonesRef.current));
            }
        }
    };

    // We need to fix the effect hook to use the 'autoCaptureReal' which is stable?
    // actually 'autoCaptureReal' changes if it uses isCapturing state.
    // Let's use a Ref for isCapturing too.
    const isCapturingRef = useRef(false);

    // Re-bind the callback if dependencies change? No, mod.onFrameProcessed is set once.
    // Better: Make the callback call a stable function or use refs entirely inside it.

    // We update the callback ref pattern
    const onFrameRef = useRef<(stats: FrameStats) => void>();

    useEffect(() => {
        onFrameRef.current = (stats: FrameStats) => {
            setStatus(stats.message);
            setQualityScore(stats.score);
            setCurrentZone(stats.currentZone);
            setPose(stats.pose);
            setStability(stats.progress);

            if (stats.isStable && stats.currentZone && stats.score > 0.8) {
                if (!capturedZonesRef.current.has(stats.currentZone) && !isCapturingRef.current) {
                    autoCaptureReal(stats.currentZone);
                }
            }
        };
    });

    // Update the module callback to call current ref
    useEffect(() => {
        if (moduleRef.current) {
            moduleRef.current.onFrameProcessed = (stats) => {
                onFrameRef.current?.(stats);
            };
        }
    }, [moduleRef.current]);


    // Refined 'handleFinish'
    const handleFinish = async () => {
        if (captures.size === 0 || isCapturingRef.current) return;
        setIsCapturing(true);
        isCapturingRef.current = true;

        try {
            const uploadedKeys: Record<string, string> = {};

            // Upload all blobs
            for (const [zone, blob] of Array.from(captures.entries())) {
                const { url, key } = await getCaptureUploadUrl(sessionId);

                await fetch(url, {
                    method: "PUT",
                    body: blob,
                    headers: { "Content-Type": "image/png" }
                });

                uploadedKeys[zone] = key;
            }

            const mainKey = uploadedKeys['center'] || Object.values(uploadedKeys)[0];
            await updateSessionStatus(sessionId, 'captured', mainKey);

            setFinished(true);
            toast.success("All photos uploaded!");

        } catch (e) {
            console.error(e);
            toast.error("Upload failed");
            setIsCapturing(false);
            isCapturingRef.current = false;
        }
    };

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

    if (finished) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <div className="mb-6 w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Success!</h2>
                <p className="text-zinc-400">Your scan is complete. Check your desktop.</p>
            </div>
        );
    }

    // Helper to determine active guide arrow
    const centerDone = capturedZones.has('center');
    const leftDone = capturedZones.has('left-30');

    // Logic: Center -> Left -> Right
    const showLeftArrow = centerDone && !leftDone;
    const showRightArrow = centerDone && leftDone && !capturedZones.has('right-30');

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
            {/* The Camera Feed */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                <video ref={videoRef} className="hidden" playsInline muted />
                <div className="relative w-full h-full flex items-center justify-center">
                    <canvas ref={canvasRef} className="object-cover h-full w-full" />
                </div>

                {/* --- HUD OVERLAYS --- */}

                {/* 1. Zone Indicators (Top Arc) */}
                <div className="absolute top-20 left-0 right-0 flex justify-center gap-2 pointer-events-none z-10">
                    {ZONES.map((z) => {
                        const isCaptured = capturedZones.has(z.id);
                        const isCurrent = currentZone === z.id;
                        return (
                            <div key={z.id} className="flex flex-col items-center gap-1 transition-all duration-300">
                                <div className={cn(
                                    "w-3 h-3 rounded-full transition-all duration-300 border border-black/20",
                                    isCaptured ? "bg-green-500 scale-110" :
                                        isCurrent ? "bg-white scale-125 shadow-glow" : "bg-white/20"
                                )} />
                                {isCurrent && (
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/50 px-2 py-0.5 rounded-full absolute top-5 whitespace-nowrap">
                                        {z.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 2. Progress Ring (Center) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Base Circle */}
                    <svg className="w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] opacity-20" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
                    </svg>

                    {/* Active Zone Stability Arc */}
                    <svg className="w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] rotate-[-90deg] transition-all duration-200" viewBox="0 0 100 100">
                        <circle
                            cx="50" cy="50" r="48"
                            fill="none"
                            stroke={stability >= 100 ? "#22c55e" : "#3b82f6"}
                            strokeWidth="3"
                            strokeDasharray={`${stability * 3.01} 301`}
                            strokeLinecap="round"
                            className="transition-all duration-200 ease-linear"
                        />
                    </svg>
                </div>

                {/* 3. Turn Guidance Arrows */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none opacity-60">
                    <ArrowLeft className={cn("w-12 h-12 text-white animate-pulse", showLeftArrow ? "opacity-100" : "opacity-0")} />
                    <ArrowRight className={cn("w-12 h-12 text-white animate-pulse", showRightArrow ? "opacity-100" : "opacity-0")} />
                </div>

                {/* Status Badge */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none z-10">
                    <div className={cn(
                        "px-6 py-3 rounded-full backdrop-blur-md font-medium text-sm transition-colors shadow-xl border border-white/10 flex items-center gap-2",
                        qualityScore > 0.8 || stability > 0 ? "bg-black/60 text-white" : "bg-red-500/80 text-white"
                    )}>
                        {stability > 0 && stability < 100 && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                        {status}
                        {stability >= 100 && <span className="text-green-400 ml-1">✓</span>}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="h-32 bg-zinc-950 p-6 flex items-center justify-between relative z-20 border-t border-zinc-900">
                <div className="text-xs text-zinc-500 max-w-[120px]">
                    {captures.size} / 5 angles captured
                </div>

                {/* Manual Trigger / Finish Button */}
                <button
                    onClick={handleFinish}
                    disabled={isCapturing || captures.size < 1}
                    className={cn(
                        "px-8 py-3 rounded-full font-bold text-sm transition-all flex items-center gap-2",
                        captures.size >= 1
                            ? "bg-white text-black hover:scale-105"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finish"}
                </button>
            </div>
        </div>
    );
}
