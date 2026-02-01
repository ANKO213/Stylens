"use client";

import { useEffect, useRef, useState } from "react";
import { FaceCaptureModule, FrameStats, TargetZone, Pose } from "@/lib/face-capture-module";
import { updateSessionStatus, getCaptureUploadUrl } from "@/app/actions/capture-session";
import { Loader2, Camera, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SmartCameraProps {
    sessionId: string;
}

// SIMPLIFIED: Only 3 zones
const ZONES: { id: TargetZone; label: string; angle: number }[] = [
    { id: 'left', label: 'Left Side', angle: 30 },
    { id: 'center', label: 'Front', angle: 0 },
    { id: 'right', label: 'Right Side', angle: -30 },
];

export function SmartCamera({ sessionId }: SmartCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const moduleRef = useRef<FaceCaptureModule | null>(null);

    const [status, setStatus] = useState<string>("Initializing...");
    const [qualityScore, setQualityScore] = useState(0);
    const [finished, setFinished] = useState(false);
    const [initializationError, setInitializationError] = useState<string | null>(null);

    // UX State
    const [currentZone, setCurrentZone] = useState<TargetZone | null>(null);
    const [distanceProgress, setDistanceProgress] = useState(0); // 0-1 (For Distance Phase)
    const [stability, setStability] = useState(0); // 0-100 (For Capture Phase)
    const [capturedZones, setCapturedZones] = useState<Set<TargetZone>>(new Set());
    const [captures, setCaptures] = useState<Map<TargetZone, Blob>>(new Map());

    // Refs for safe callback access
    const capturedZonesRef = useRef<Set<TargetZone>>(new Set());
    const isCapturingRef = useRef(false);
    const onFrameRef = useRef<((stats: FrameStats) => void) | undefined>(undefined);

    // Initialize Camera
    useEffect(() => {
        let active = true;

        const init = async () => {
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

                        mod.onFrameProcessed = (stats) => {
                            onFrameRef.current?.(stats);
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

    // Frame Callback
    useEffect(() => {
        onFrameRef.current = (stats: FrameStats) => {
            setStatus(stats.message);
            setQualityScore(stats.score);
            setCurrentZone(stats.currentZone);
            setStability(stats.progress);
            setDistanceProgress(stats.distanceProgress);

            // Auto-Capture Logic
            if (stats.isStable && stats.currentZone && stats.score > 0.8) {
                if (!capturedZonesRef.current.has(stats.currentZone) && !isCapturingRef.current) {
                    autoCaptureReal(stats.currentZone, stats.scaleFactor);
                }
            }
        };
    });

    const autoCaptureReal = async (zone: TargetZone, currentScale: number) => {
        if (capturedZonesRef.current.has(zone) || isCapturingRef.current) return;

        // Optimistic Update
        capturedZonesRef.current.add(zone);
        setCapturedZones(new Set(capturedZonesRef.current));

        toast.success(`Captured ${zone.toUpperCase()}!`);

        // ZOOM LOCK LOGIC:
        // If we just captured Center, LOCK the scale for subsequent side shots.
        if (zone === 'center' && moduleRef.current) {
            moduleRef.current.lockScale(currentScale);
        }

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

    const handleFinish = async () => {
        if (captures.size === 0 || isCapturingRef.current) return;
        isCapturingRef.current = true;

        try {
            const uploadedKeys: Record<string, string> = {};

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
            toast.success("Ready!");

        } catch (e) {
            console.error(e);
            toast.error("Upload failed");
            isCapturingRef.current = false;
        }
    };

    const getPrimaryState = () => {
        // Workflow: Center -> Left -> Right
        if (!capturedZones.has('center')) return 'center';
        if (!capturedZones.has('left')) return 'left';
        if (!capturedZones.has('right')) return 'right';
        return 'done';
    };

    const guideState = getPrimaryState();

    // UI Calculation for Dual-Phase Bar
    // Phase 1: Distance (0 -> 100%)
    // Phase 2: Stability (0 -> 100%)
    // We combine visually: Gray->White (Distance), White->Green (Stability)

    // Logic: 
    // If stability > 0, we are "locked in" distance-wise, so show stability logic.
    // If stability == 0, show distance logic.
    // Note: 'stability' in module only rises if distance is good (>0.8).

    const showStability = stability > 0;
    const progressValue = showStability ? stability : (distanceProgress * 100);
    const progressColor = showStability ? "bg-green-500" : "bg-white";
    const trackColor = "bg-zinc-800"; // Grey

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

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                <video ref={videoRef} className="hidden" playsInline muted />
                <div className="relative w-full h-full flex items-center justify-center">
                    <canvas ref={canvasRef} className="object-cover h-full w-full" />
                </div>

                {/* --- CENTER GUIDANCE TEXT --- */}
                {/* Shows big text instructions when not capturing center */}
                {guideState === 'left' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center animate-pulse">
                            <ArrowLeft className="w-20 h-20 text-white/50 mb-4" />
                            <h2 className="text-4xl font-bold text-white tracking-widest uppercase drop-shadow-lg">Turn Left</h2>
                        </div>
                    </div>
                )}
                {guideState === 'right' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center animate-pulse">
                            <ArrowRight className="w-20 h-20 text-white/50 mb-4" />
                            <h2 className="text-4xl font-bold text-white tracking-widest uppercase drop-shadow-lg">Turn Right</h2>
                        </div>
                    </div>
                )}

                {/* --- HUD --- */}

                {/* 1. Zone Indicators (Top) */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-3 pointer-events-none z-10">
                    {ZONES.map((z) => {
                        const isCaptured = capturedZones.has(z.id);
                        const isCurrent = guideState === z.id; // Highlight what we WANT the user to do
                        return (
                            <div key={z.id} className="flex flex-col items-center gap-1 transition-all duration-300">
                                <div className={cn(
                                    "w-3 h-3 rounded-full transition-all duration-300",
                                    isCaptured ? "bg-green-500 scale-125" :
                                        isCurrent ? "bg-white scale-150 shadow-glow animate-pulse" : "bg-white/30"
                                )} />
                            </div>
                        );
                    })}
                </div>

                {/* 2. DUAL-PHASE PROGRESS BAR (Bottom) */}
                <div className="absolute bottom-24 left-8 right-8 pointer-events-none z-10 flex flex-col items-center gap-2">
                    {/* Status Text */}
                    <span className="text-white/80 font-medium text-sm tracking-wide shadow-black drop-shadow-md">
                        {status}
                    </span>

                    {/* The Bar */}
                    <div className="w-full max-w-xs h-3 bg-zinc-800/80 backdrop-blur-md rounded-full overflow-hidden border border-white/10 relative">
                        <div
                            className={cn("h-full transition-all duration-200 ease-out", progressColor)}
                            style={{ width: `${Math.max(5, progressValue)}%` }}
                        ></div>

                        {/* Optional markers for "Good Zone" if passing through phases? No, keep simple. */}
                    </div>

                    {/* Helper text explaining the bar */}
                    <div className="flex justify-between w-full max-w-xs text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                        <span>Distance</span>
                        <span>Hold</span>
                    </div>
                </div>

                {/* 3. Controls (Manual Finish) */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
                    {captures.size >= 1 && (
                        <button
                            onClick={handleFinish}
                            className="text-xs text-white/50 underline hover:text-white transition-colors"
                        >
                            Skip & Finish ({captures.size}/3)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
