// import { FaceMesh, Results } from "@mediapipe/face_mesh"; 
// ^ BROKEN in Next.js 16 / Turbopack due to missing exports.
// We will load via CDN script injection.

import { analyzeLight, calculateSharpness, imageDataToBlob, FrameAccumulator } from "./image-processing";

type Results = any;
type FaceMesh = any;

declare global {
    interface Window {
        FaceMesh: any;
    }
}

// SIMPLIFIED: Only 3 major zones
export type TargetZone = 'center' | 'left' | 'right';

export interface Pose {
    yaw: number;   // -90 to 90
    pitch: number; // -90 to 90
    roll: number;  // -90 to 90
}

export interface FrameStats {
    distance: number;
    faceFound: boolean;
    message: string;
    scaleFactor: number;
    score: number;
    pose: Pose;
    currentZone: TargetZone | null;
    isStable: boolean;
    progress: number; // 0 to 100
    distanceProgress: number; // 0 to 1 (new)
    isBursting?: boolean; // UI State
}

export class FaceCaptureModule {
    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private faceMesh: FaceMesh | null = null;
    private isRunning = false;
    private animationFrameId: number | null = null;
    private scriptLoaded = false;

    // Config
    // User requested 60% of screen height
    private targetFaceHeightRatio = 0.60;

    // State for smoothing (Kalman-ish / Lerp)
    private currentScale = 1.0;
    private currentCx = 0;
    private currentCy = 0;

    // Stability Tracking
    private lastZone: TargetZone | null = null;
    private zoneEnterTime: number = 0;
    private stabilityProgress: number = 0;
    private readonly STABILITY_THRESHOLD_MS = 600;

    // Zoom Lock for Sides
    private lockedScale: number | null = null;

    // Burst State
    private isBursting = false;

    // Logic state
    public distance: number = 0;
    public faceFound: boolean = false;
    public onFrameProcessed?: (stats: FrameStats) => void;

    constructor(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement) {
        this.video = videoEl;
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext("2d")!;

        // Init centers to avoid jump
        this.currentCx = canvasEl.width / 2;
        this.currentCy = canvasEl.height / 2;
    }

    private loadMediaPipeScript(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (window.FaceMesh) {
                resolve();
                return;
            }
            if (this.scriptLoaded) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
            script.crossOrigin = "anonymous";
            script.onload = () => {
                this.scriptLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    private async initFaceMesh() {
        if (this.faceMesh) return;

        await this.loadMediaPipeScript();

        this.faceMesh = new window.FaceMesh({
            locateFile: (file: string) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults(this.onResults.bind(this));
    }

    public async start(streamAlreadyActive = false) {
        if (this.isRunning) return;

        try {
            await this.initFaceMesh();
        } catch (e) {
            console.error("Failed to load FaceMesh", e);
            throw new Error("Failed to load facial recognition engine");
        }

        this.isRunning = true;

        // Reset state
        this.currentCx = this.canvas.width / 2;
        this.currentCy = this.canvas.height / 2;
        this.currentScale = 1.0;
        this.stabilityProgress = 0;
        this.lastZone = null;
        this.lockedScale = null;
        this.isBursting = false;

        if (!streamAlreadyActive) {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera access not supported. Use HTTPS.");
                }

                // Request 4K/High Res
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 3840 },
                        height: { ideal: 2160 },
                        facingMode: "user"
                    }
                });
                this.video.srcObject = stream;
                await this.video.play();
            } catch (e) {
                console.error("Camera failed", e);
                this.isRunning = false;
                throw e;
            }
        }

        this.processFrame();
    }

    private async processFrame() {
        if (!this.isRunning) return;

        // Fallback: If FaceMesh isn't ready or hasn't returned result yet
        if (!this.faceMesh) {
            const { width, height } = this.canvas;
            this.ctx.save();
            // Simple Mirror
            this.ctx.translate(width, 0);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.video, 0, 0, width, height);
            this.ctx.restore();

            this.ctx.font = "20px Arial";
            this.ctx.fillStyle = "white";
            this.ctx.fillText("Loading AI...", 50, 50);
        }

        if (this.video.readyState >= 2 && this.faceMesh && !this.isBursting) {
            // Only create detection overhead if NOT bursting
            await this.faceMesh.send({ image: this.video });
        } else if (this.isBursting) {
            // Freeze view on what we are scanning? 
            // Or just keep drawing last frame?
            // Detection is paused.
            const { width, height } = this.canvas;
            // Draw current video feed so user sees what's happening
            this.ctx.save();
            this.ctx.translate(width / 2, height / 2);
            this.ctx.scale(-this.currentScale, this.currentScale);
            this.ctx.translate(-this.currentCx, -this.currentCy);
            this.ctx.drawImage(this.video, 0, 0, width, height);
            this.ctx.restore();
        }

        this.animationFrameId = requestAnimationFrame(this.processFrame.bind(this));
    }

    public stop() {
        this.isRunning = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        const stream = this.video.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        this.video.srcObject = null;
    }

    public lockScale(scale: number) {
        this.lockedScale = scale;
    }

    // --- SUPER-RESOLUTION BURST (Optimized) ---

    public async takeBurstPhoto(): Promise<Blob> {
        if (this.isBursting) throw new Error("Already capturing");
        this.isBursting = true;

        let accumulator: FrameAccumulator | null = null;

        try {
            // 1. Setup Capture
            const MAX_FRAMES = 12; // Reduced from 20 to safe memory
            const videoW = this.video.videoWidth;
            const videoH = this.video.videoHeight;

            const captureCanvas = new OffscreenCanvas(videoW, videoH);
            const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

            if (!captureCtx) throw new Error("Failed to init offscreen canvas");

            // Initialize Accumulator (130MB buffer)
            accumulator = new FrameAccumulator(videoW, videoH);

            console.log(`Starting Burst: ${videoW}x${videoH} for ${MAX_FRAMES} frames`);

            // 2. Loop
            let validFrames = 0;

            for (let i = 0; i < MAX_FRAMES; i++) {
                // Draw current video frame to offscreen
                // Note: captureCtx is reused
                captureCtx.drawImage(this.video, 0, 0);
                const imageData = captureCtx.getImageData(0, 0, videoW, videoH);

                // 3. Light Check (First Frame Only - Fail Fast)
                if (i === 0) {
                    const light = analyzeLight(imageData);
                    if (light.isLowLight) {
                        throw new Error("Low light detected. Increase brightness.");
                    }
                }

                // 4. Sharpness Check
                const sharpness = calculateSharpness(imageData);

                // Simple threshold logic: If < 10 (very blurry), discard.
                // Typical sharpness for detailed face ~20-50.
                if (sharpness > 5) {
                    accumulator.add(imageData);
                    validFrames++;
                }

                // Small delay to allow camera sensor update 
                // 30fps = 33ms. 
                await new Promise(r => setTimeout(r, 40));
            }

            if (validFrames === 0) throw new Error("All frames were too blurry. Hold steady.");

            // 5. Finalize
            const stackedImageData = accumulator.getResult();

            // Cleanup
            accumulator.dispose();
            accumulator = null;

            // 7. Convert to Blob
            this.isBursting = false;
            return await imageDataToBlob(stackedImageData);

        } catch (e) {
            this.isBursting = false;
            if (accumulator) accumulator.dispose();
            throw e;
        }
    }

    // Fallback if burst fails or user wants simple
    public takePhoto(): Promise<Blob | null> {
        return this.takeBurstPhoto();
    }


    // --- MATH HELPERS ---

    private calculatePose(landmarks: any[], width: number, height: number): Pose {
        // Geometric approximation of Euler angles
        const nose = landmarks[1]; // Tip of nose
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        // ROLL
        const dy = (rightEye.y - leftEye.y) * height;
        const dx = (rightEye.x - leftEye.x) * width;
        const rollRad = Math.atan2(dy, dx);
        const roll = rollRad * (180 / Math.PI);

        // PITCH
        const midEarY = (leftEar.y + rightEar.y) / 2;
        const noseY = nose.y;
        const pitchDiff = (midEarY - noseY);
        const pitch = pitchDiff * 140;

        // YAW 2D
        const dLeft = Math.abs(nose.x - leftEar.x);
        const dRight = Math.abs(nose.x - rightEar.x);
        const total = dLeft + dRight;
        let yaw = 0;
        if (total > 0) {
            const ratio = (dRight - dLeft) / total;
            yaw = ratio * 90;
        }

        return { yaw, pitch, roll };
    }

    private determineZone(pose: Pose): TargetZone | null {
        const { yaw } = pose;

        if (Math.abs(yaw) < 15) return 'center';

        if (yaw >= 20) return 'left';
        if (yaw <= -20) return 'right';

        return null;
    }

    private onResults(results: Results) {
        const { width, height } = this.canvas;

        // Reset transform to clear
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, width, height);

        let targetScale = this.currentScale; // Default to LAST scale (Persistence)
        let targetCx = width / 2;
        let targetCy = height / 2;
        let pose: Pose = { yaw: 0, pitch: 0, roll: 0 };
        let currentZone: TargetZone | null = null;
        let score = 0;
        let message = "Scanning...";
        let distanceProgress = 0; // 0 to 1

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceFound = true;
            const landmarks = results.multiFaceLandmarks[0];

            // 1. Calculate Pose
            pose = this.calculatePose(landmarks, width, height);
            currentZone = this.determineZone(pose);

            // 2. Calculate Scale
            // If LOCKED (for side views), use that. Else calculate.
            if (this.lockedScale && currentZone !== 'center') {
                targetScale = this.lockedScale;
            } else {
                // Height-based Scaling
                const top = landmarks[10];
                const bottom = landmarks[152];
                const hDx = (top.x - bottom.x) * width;
                const hDy = (top.y - bottom.y) * height;
                const faceHeightPx = Math.sqrt(hDx * hDx + hDy * hDy);

                const desiredHeightPx = height * this.targetFaceHeightRatio;
                // Only calibrate scale if in center zone for stability
                if (currentZone === 'center') {
                    targetScale = desiredHeightPx / (faceHeightPx + 1);
                    targetScale = Math.max(1.0, Math.min(targetScale, 4.0));
                } else {
                    targetScale = this.currentScale;
                }
            }

            // 3. Face Center
            const nose = landmarks[6];
            targetCx = nose.x * width;
            targetCy = nose.y * height;

            // 4. Distance Logic (Iris)
            const lIris = landmarks[468];
            const rIris = landmarks[473];
            const irisDx = rIris.x - lIris.x;
            const irisDy = rIris.y - lIris.y;
            const irisDist = Math.sqrt(irisDx * irisDx + irisDy * irisDy);
            const approxDist = 4.0 / (irisDist + 0.001);
            this.distance = Math.round(approxDist);

            // Normalize Distance
            const optimalCenter = 70;
            const maxDiff = 40;
            const diff = Math.abs(this.distance - optimalCenter);
            distanceProgress = Math.max(0, 1.0 - (diff / maxDiff));

            if (this.distance < 50) message = "Too close!";
            else if (this.distance > 90) message = "Too far!";
            else message = this.faceFound ? "Hold steady" : "Look at camera";

            score = 0.9;

            // 5. Stability Logic
            const now = performance.now();
            const distanceGood = distanceProgress > 0.8;
            const canStabilize = distanceGood || (!!this.lockedScale);

            if (currentZone && currentZone !== this.lastZone) {
                this.lastZone = currentZone;
                this.zoneEnterTime = now;
                this.stabilityProgress = 0;
            }

            if (currentZone && canStabilize) {
                const elapsed = now - this.zoneEnterTime;
                this.stabilityProgress = Math.min(100, (elapsed / this.STABILITY_THRESHOLD_MS) * 100);
            } else {
                this.stabilityProgress = Math.max(0, this.stabilityProgress - 5);
                this.zoneEnterTime = now;
            }

        } else {
            this.faceFound = false;
            targetScale = this.currentScale; // Keep last known scale
            targetCx = width / 2;
            targetCy = height / 2;
            this.stabilityProgress = 0;
            message = "No face";
            distanceProgress = 0;
        }

        // 6. Smoothing
        const alpha = 0.15;
        this.currentScale = this.currentScale * (1 - alpha) + targetScale * alpha;
        this.currentCx = this.currentCx * (1 - alpha) + targetCx * alpha;
        this.currentCy = this.currentCy * (1 - alpha) + targetCy * alpha;

        // 7. Draw
        if (!this.isBursting) {
            this.ctx.save();
            this.ctx.translate(width / 2, height / 2);
            this.ctx.scale(-this.currentScale, this.currentScale);
            this.ctx.translate(-this.currentCx, -this.currentCy);
            this.ctx.drawImage(results.image, 0, 0, width, height);
            this.ctx.restore();
        }

        // 8. Callbacks
        if (this.onFrameProcessed) {
            this.onFrameProcessed({
                distance: this.distance,
                faceFound: this.faceFound,
                message,
                scaleFactor: this.currentScale, // Return current smoothed scale
                score,
                pose,
                currentZone,
                isStable: this.stabilityProgress >= 100,
                progress: this.stabilityProgress,
                distanceProgress,
                isBursting: this.isBursting
            });
        }
    }
}
