// import { FaceMesh, Results } from "@mediapipe/face_mesh"; 
// ^ BROKEN in Next.js 16 / Turbopack due to missing exports.
// We will load via CDN script injection.

import { analyzeLight, calculateSharpness, stackFrames, imageDataToBlob } from "./image-processing";

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
            // During burst, we pause detection updates to save CPU for frame capture?
            // Actually, we need detection to run to keep 'faceFound' true?
            // Let's run it.
            await this.faceMesh.send({ image: this.video });
        } else if (this.isBursting) {
            // If bursting, we might skip face mesh updates to prioritize frame capture speed
            // But we still need to draw the video feed?
            const { width, height } = this.canvas;
            // We can just rely on the last known transform
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

    // --- SUPER-RESOLUTION BURST ---

    public async takeBurstPhoto(): Promise<Blob> {
        if (this.isBursting) throw new Error("Already capturing");
        this.isBursting = true;

        try {
            // 1. Setup Capture
            const frames: ImageData[] = [];
            const MAX_FRAMES = 20;
            const captureCanvas = new OffscreenCanvas(this.video.videoWidth, this.video.videoHeight);
            const captureCtx = captureCanvas.getContext('2d');

            if (!captureCtx) throw new Error("Failed to init offscreen canvas");

            // 2. Continuous Capture Loop
            // We want to capture as fast as possible.
            // Using a tight loop with requestAnimationFrame or just setInterval?
            // await delay betwen frames?

            for (let i = 0; i < MAX_FRAMES; i++) {
                // Draw current video frame to offscreen
                captureCtx.drawImage(this.video, 0, 0);
                const imageData = captureCtx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);

                // 3. Light Check (First Frame Only - Fail Fast)
                if (i === 0) {
                    const light = analyzeLight(imageData);
                    if (light.isLowLight) {
                        throw new Error("Low light detected. Increase brightness.");
                    }
                }

                // 4. Sharpness Check
                const sharpness = calculateSharpness(imageData);
                // Threshold: Needs tuning. Typical variance for sharp 4K image > 50?
                // Relative to what?
                // Let's just collect all and sort by sharpness later or discard significantly blurry?
                // For now, let's keep top 50% sharpest.

                // Attach metadata to frame object locally (not ImageData)
                // Just push to array with metadata
                // @ts-ignore
                imageData._sharpness = sharpness;
                frames.push(imageData);

                // Small delay to allow camera to update? 
                // Video runs at 30/60fps. roughly 16ms or 33ms.
                // If we run tighter than that, we get duplicate frames.
                await new Promise(r => setTimeout(r, 33));
            }

            // 5. Select Best Frames
            // Sort by sharpness descending
            // @ts-ignore
            frames.sort((a, b) => b._sharpness - a._sharpness);

            // Keep top 10 frames (best 50%)
            const bestFrames = frames.slice(0, 10);

            // 6. Stack & Denoise
            const stackedImageData = stackFrames(bestFrames);

            // 7. Convert to Blob
            this.isBursting = false;
            return await imageDataToBlob(stackedImageData);

        } catch (e) {
            this.isBursting = false;
            throw e;
        }
    }

    // Fallback if burst fails or user wants simple
    public takePhoto(): Promise<Blob | null> {
        return this.takeBurstPhoto();
        // Or default logic:
        /*
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png', 1.0);
        });
        */
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
