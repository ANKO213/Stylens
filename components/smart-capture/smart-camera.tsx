"use client";

import { useEffect, useRef, useState } from "react";
import { FaceCaptureModule, FrameStats, TargetZone, Pose } from "@/lib/face-capture-module";
import { updateSessionStatus, uploadCaptureImage } from "@/app/actions/capture-session";
import { Loader2, Camera, CheckCircle, ArrowRight, ArrowLeft, RefreshCcw } from "lucide-react";
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

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export function SmartCamera({ sessionId }: SmartCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const moduleRef = useRef<FaceCaptureModule | null>(null);

    const [status, setStatus] = useState<string>("Initializing...");
    const [qualityScore, setQualityScore] = useState(0);
    const [finished, setFinished] = useState(false);

    // UI State
    const [isEnhancing, setIsEnhancing] = useState(false); // "Bursting"
    const [isFinishing, setIsFinishing] = useState(false); // Final Loader
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null); // Explicit error feedback

    // Upload State
    const [uploadState, setUploadState] = useState<Record<string, UploadStatus>>({});

    // UX State
    const [currentZone, setCurrentZone] = useState<TargetZone | null>(null);
    const [distanceProgress, setDistanceProgress] = useState(0);
    const [stability, setStability] = useState(0);
    const [capturedZones, setCapturedZones] = useState<Set<TargetZone>>(new Set());

    // Data (Ref to avoid re-renders during rapid logic)
    const capturesRef = useRef<Map<TargetZone, Blob>>(new Map());
    const uploadedKeysRef = useRef<Record<string, string>>({});
    const uploadPromisesRef = useRef<Record<string, Promise<void>>>({});

    // Logic Refs
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
                        throw new Error("Camera access not supported. Use HTTPS.");
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
            if (isEnhancing) return; // Don't update during burst (stats are frozen anyway)

            setStatus(stats.message);
            setQualityScore(stats.score);
            setCurrentZone(stats.currentZone);
            setStability(stats.progress);
            setDistanceProgress(stats.distanceProgress);

            // Auto-Capture Logic
            if (stats.isStable && stats.currentZone && stats.score > 0.8) {
                if (!capturedZonesRef.current.has(stats.currentZone) && !isCapturingRef.current && !isFinishing) {
                    autoCaptureReal(stats.currentZone, stats.scaleFactor);
                }
            }
        };
    });

    // AUTO-FINISH
    useEffect(() => {
        if (capturedZones.size === 3 && !finished && !isFinishing) {
            handleFinish();
        }
    }, [capturedZones, finished, isFinishing]);

    const getPrimaryState = () => {
        if (!capturedZones.has('center')) return 'center';
        if (!capturedZones.has('left')) return 'left';
        if (!capturedZones.has('right')) return 'right';
        return 'done';
    };

    const guideState = getPrimaryState();

    const handleBackgroundUpload = async (zone: TargetZone, blob: Blob) => {
        setUploadState(prev => ({ ...prev, [zone]: 'uploading' }));

        try {
            const formData = new FormData();
            formData.append('file', blob, `${zone}.jpg`);

            const res = await uploadCaptureImage(sessionId, zone, formData);
            if (res && res.key) {
                uploadedKeysRef.current[zone] = res.key;
                setUploadState(prev => ({ ...prev, [zone]: 'done' }));
            } else {
                throw new Error("No key returned");
            }
        } catch (e) {
            console.error(`Upload failed for ${zone}`, e);
            setUploadState(prev => ({ ...prev, [zone]: 'error' }));
            // Don't toast here to avoid spam, error will be shown in UI dot
        }
    };

    const autoCaptureReal = async (zone: TargetZone, currentScale: number) => {
        if (capturedZonesRef.current.has(zone) || isCapturingRef.current) return;

        isCapturingRef.current = true;
        setIsEnhancing(true);
        setLastError(null); // Clear previous errors

        // ZOOM LOCK LOGIC
        if (zone === 'center' && moduleRef.current) {
            moduleRef.current.lockScale(currentScale);
        }

        if (moduleRef.current) {
            try {
                // SINGLE SHOT CAPTURE
                const blob = await moduleRef.current.takePhoto();

                if (blob) {
                    capturesRef.current.set(zone, blob);

                    // Mark Captured
                    capturedZonesRef.current.add(zone);
                    setCapturedZones(new Set(capturedZonesRef.current));

                    toast.success(`Captured ${zone.toUpperCase()}!`, { id: 'capture-toast' });

                    // START UPLOAD IN BACKGROUND
                    const uploadPromise = handleBackgroundUpload(zone, blob);
                    uploadPromisesRef.current[zone] = uploadPromise;
                }
            } catch (e: any) {
                console.error("Capture failed", e);
                setLastError(e.message || "Capture Failed");

                if (e.message.includes("Low light")) {
                    toast.error("Too Dark! Increase brightness.", { id: 'capture-toast' });
                } else if (e.message.includes("Blurry")) {
                    toast.error("Too Blurry! Hold Steady.", { id: 'capture-toast' });
                } else {
                    toast.error("Capture failed. Try again.", { id: 'capture-toast' });
                }
            }
        }

        setIsEnhancing(false);
        isCapturingRef.current = false;
    };

    const handleFinish = async () => {
        if (capturesRef.current.size === 0) return;
        if (isFinishing) return;

        setIsFinishing(true);
        setLastError(null);

        try {
            // 1. Retry/Start missing uploads
            const missingUploads: Promise<void>[] = [];

            for (const [zone, blob] of Array.from(capturesRef.current.entries())) {
                const status = uploadState[zone];
                // If not done and not currently uploading, retry
                if (status !== 'done' && status !== 'uploading') {
                    const p = handleBackgroundUpload(zone, blob);
                    uploadPromisesRef.current[zone] = p;
                    missingUploads.push(p);
                }
            }

            // 2. Wait for all active uploads
            // We wait for existing promises + new ones
            const allPromises = Object.values(uploadPromisesRef.current);
            if (allPromises.length > 0) {
                await Promise.all(allPromises);
            }

            // 3. Verify all uploaded
            const keys = uploadedKeysRef.current;
            const allZones = Array.from(capturesRef.current.keys());
            const missingKeys = allZones.filter(z => !keys[z]);

            if (missingKeys.length > 0) {
                throw new Error(`Failed to upload: ${missingKeys.join(', ')}. Please retry.`);
            }

            // 4. Finalize
            const mainKey = keys['center'] || Object.values(keys)[0];
            await updateSessionStatus(sessionId, 'captured', mainKey);

            setFinished(true);
            toast.success("Ready!");

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Upload failed");
            setLastError(e.message);
            setIsFinishing(false);
        }
    };

    const showStability = stability > 0;
    const progressValue = showStability ? stability : (distanceProgress * 100);
    const progressColor = showStability ? "bg-green-500" : "bg-white";

    if (initializationError) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-8 text-center space-y-6">
                {/* Error View */}
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                    <Camera className="w-8 h-8 text-red-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold mb-2 text-red-400">Camera Error</h2>
                    <p className="text-zinc-400 max-w-sm mx-auto text-sm leading-relaxed mb-4">
                        {initializationError}
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm"
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

                {/* --- LOADING OVERLAYS --- */}

                {/* 1. Burst Processing */}
                {isEnhancing && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                        <span className="text-white font-bold tracking-widest uppercase text-sm">Capturing...</span>
                        <span className="text-white/50 text-xs mt-2">Hold steady</span>
                    </div>
                )}

                {/* 2. Uploading Finalizer */}
                {isFinishing && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                        <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
                        <span className="text-white font-bold tracking-widest uppercase text-lg">Finalizing...</span>
                        <span className="text-white/50 text-xs mt-2">Uploading High-Res Images</span>
                    </div>
                )}


                {/* --- CENTER GUIDANCE TEXT --- */}
                {guideState === 'left' && !isEnhancing && !isFinishing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
                        <div className="flex flex-col items-center animate-pulse">
                            <ArrowLeft className="w-20 h-20 text-white/50 mb-4" />
                            <h2 className="text-4xl font-bold text-white tracking-widest uppercase drop-shadow-lg">Turn Left</h2>
                        </div>
                    </div>
                )}
                {guideState === 'right' && !isEnhancing && !isFinishing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
                        <div className="flex flex-col items-center animate-pulse">
                            <ArrowRight className="w-20 h-20 text-white/50 mb-4" />
                            <h2 className="text-4xl font-bold text-white tracking-widest uppercase drop-shadow-lg">Turn Right</h2>
                        </div>
                    </div>
                )}

                {/* --- ERROR FEEDBACK --- */}
                {lastError && !isEnhancing && !isFinishing && (
                    <div className="absolute top-24 left-0 right-0 flex justify-center pointer-events-none z-20">
                        <div className="bg-red-500/90 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-bounce flex items-center gap-2">
                            <span>⚠️ {lastError}</span>
                        </div>
                    </div>
                )}

                {/* --- HUD --- */}
                {!isFinishing && (
                    <>
                        {/* 1. Zone Indicators (Top) */}
                        <div className="absolute top-8 left-0 right-0 flex justify-center gap-4 pointer-events-none z-10">
                            {ZONES.map((z) => {
                                const isCaptured = capturedZones.has(z.id);
                                const isCurrent = guideState === z.id;
                                const uploadStatus = uploadState[z.id];

                                let colorClass = "bg-white/30";
                                if (isCaptured) colorClass = "bg-blue-500"; // Captured
                                if (uploadStatus === 'done') colorClass = "bg-green-500"; // Uploaded
                                if (uploadStatus === 'error') colorClass = "bg-red-500"; // Error

                                return (
                                    <div key={z.id} className="flex flex-col items-center gap-1 transition-all duration-300">
                                        <div className={cn(
                                            "w-4 h-4 rounded-full transition-all duration-300 border-2 border-transparent",
                                            isCurrent && "border-white scale-125 shadow-glow",
                                            colorClass
                                        )} />
                                        {uploadStatus === 'uploading' && (
                                            <Loader2 className="w-3 h-3 text-white animate-spin absolute -top-4" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 2. DUAL-PHASE PROGRESS BAR (Bottom) */}
                        <div className="absolute bottom-24 left-8 right-8 pointer-events-none z-10 flex flex-col items-center gap-2">
                            <span className="text-white/80 font-medium text-sm tracking-wide shadow-black drop-shadow-md">
                                {isEnhancing ? "Enhancing..." : status}
                            </span>

                            <div className="w-full max-w-xs h-3 bg-zinc-800/80 backdrop-blur-md rounded-full overflow-hidden border border-white/10 relative">
                                <div
                                    className={cn("h-full transition-all duration-200 ease-out", progressColor)}
                                    style={{ width: `${Math.max(5, progressValue)}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between w-full max-w-xs text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                                <span>Distance</span>
                                <span>Hold</span>
                            </div>
                        </div>

                        {/* 3. Controls (Retry/Finish) */}
                        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
                            {capturedZones.size >= 1 && (
                                <button
                                    onClick={() => handleFinish()}
                                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
                                >
                                    <RefreshCcw className="w-3 h-3" />
                                    {Object.values(uploadState).some(s => s === 'error') ? "Retry Uploads" : "Finish Early"}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
