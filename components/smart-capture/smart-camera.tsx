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

    // Multi-Angle State
    const [currentZone, setCurrentZone] = useState<TargetZone | null>(null);
    const [stability, setStability] = useState(0);
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

    // Guidance Logic
    const centerDone = capturedZones.has('center');
    const leftDone = capturedZones.has('left');

    // Order: Center -> Left -> Right (Arbitrary, user can choose)
    // Actually, user can turn either way.
    const showLeftArrow = centerDone && !leftDone;
    const showRightArrow = centerDone && !capturedZones.has('right');

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                <video ref={videoRef} className="hidden" playsInline muted />
                <div className="relative w-full h-full flex items-center justify-center">
                    <canvas ref={canvasRef} className="object-cover h-full w-full" />
                </div>

                {/* --- HUD OVERLAYS --- */}

                {/* 1. Zone Indicators (Top) */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-3 pointer-events-none z-10">
                    {ZONES.map((z) => {
                        const isCaptured = capturedZones.has(z.id);
                        const isCurrent = currentZone === z.id;
                        return (
                            <div key={z.id} className="flex flex-col items-center gap-1 transition-all duration-300">
                                <div className={cn(
                                    "w-2 h-2 rounded-full transition-all duration-300",
                                    isCaptured ? "bg-green-500 scale-125" :
                                        isCurrent ? "bg-white scale-150 shadow-glow" : "bg-white/30"
                                )} />
                                {isCurrent && (
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full absolute top-4 whitespace-nowrap">
                                        {z.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 2. Turn Guidance Arrows */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none opacity-60">
                    <ArrowLeft className={cn("w-12 h-12 text-white animate-pulse drop-shadow-lg", showLeftArrow ? "opacity-100" : "opacity-0")} />
                    <ArrowRight className={cn("w-12 h-12 text-white animate-pulse drop-shadow-lg", showRightArrow ? "opacity-100" : "opacity-0")} />
                </div>

                {/* 3. Status Badge with Small Ring (Bottom) */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none z-10">
                    <div className={cn(
                        "pl-2 pr-6 py-2 rounded-full backdrop-blur-md font-medium text-sm transition-colors shadow-xl border border-white/10 flex items-center gap-3",
                        qualityScore > 0.8 || stability > 0 ? "bg-black/80 text-white" : "bg-red-500/80 text-white"
                    )}>
                        {/* Small Progress Ring */}
                        <div className="relative w-8 h-8 flex items-center justify-center">
                            {/* Background Track */}
                            <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 36 36">
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="rgba(255, 255, 255, 0.2)"
                                    strokeWidth="3"
                                />
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke={stability >= 100 ? "#22c55e" : "#3b82f6"}
                                    strokeWidth="3"
                                    strokeDasharray={`${stability}, 100`}
                                    className="transition-all duration-100 ease-linear"
                                />
                            </svg>
                            {/* Inner Icon */}
                            <div className="absolute inset-0 flex items-center justify-center text-[10px]">
                                {stability >= 100 && <CheckCircle className="w-4 h-4 text-green-500 fill-current" />}
                            </div>
                        </div>

                        <span className="min-w-[80px] text-center">{status}</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="h-32 bg-zinc-950 p-6 flex items-center justify-between relative z-20 border-t border-zinc-900">
                <div className="text-xs text-zinc-500 max-w-[120px]">
                    {captures.size} / 3 angles
                </div>

                <button
                    onClick={handleFinish}
                    disabled={captures.size < 1}
                    className={cn(
                        "px-8 py-3 rounded-full font-bold text-sm transition-all flex items-center gap-2",
                        captures.size >= 1
                            ? "bg-white text-black hover:scale-105"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    Finish
                </button>
            </div>
        </div>
    );
}
