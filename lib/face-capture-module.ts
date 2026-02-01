// import { FaceMesh, Results } from "@mediapipe/face_mesh"; 
// ^ BROKEN in Next.js 16 / Turbopack due to missing exports.
// We will load via CDN script injection.

type Results = any;
type FaceMesh = any;

declare global {
    interface Window {
        FaceMesh: any;
    }
}

export type TargetZone = 'center' | 'left-30' | 'right-30' | 'left-profile' | 'right-profile';

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
    // We want the face HEIGHT to occupy this ratio of the screen height
    private targetFaceHeightRatio = 0.55;

    // State for smoothing (Kalman-ish / Lerp)
    private currentScale = 1.0;
    private currentCx = 0; // Smoothed Face Center X
    private currentCy = 0; // Smoothed Face Center Y

    // Stability Tracking
    private lastZone: TargetZone | null = null;
    private zoneEnterTime: number = 0;
    private stabilityProgress: number = 0;
    private readonly STABILITY_THRESHOLD_MS = 600;

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

        if (this.video.readyState >= 2 && this.faceMesh) {
            await this.faceMesh.send({ image: this.video });
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

    // --- MATH HELPERS ---

    private calculatePose(landmarks: any[], width: number, height: number): Pose {
        // Geometric approximation of Euler angles
        // Yaw: Ratio of NoseX between LeftEarX and RightEarX
        // Pitch: NoseY relative to EyeY/MouthY (or EarY)
        // Roll: Angle of Eye Line

        const nose = landmarks[1]; // Tip of nose
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        // ROLL
        const dy = (rightEye.y - leftEye.y) * height;
        const dx = (rightEye.x - leftEye.x) * width;
        const rollRad = Math.atan2(dy, dx);
        const roll = rollRad * (180 / Math.PI); // Degrees

        // YAW
        // Compare horizontal distances from nose to ears
        // Note: Coordinates are normalized 0-1
        const midEarX = (leftEar.x + rightEar.x) / 2;
        const noseX = nose.x;
        // The farther the nose is from the midpoint, the more rotation
        // But we need to account for scale/foreshortening.
        // Let's use Z-depth difference if available (MediaPipe FaceMesh provides estimated Z)
        // yaw ~ constant * (leftEar.z - rightEar.z) / faceWidth
        // This is usually more robust than X-ratio for MP FaceMesh
        const zDiff = (leftEar.z - rightEar.z);
        // Empirical multiplier
        const yaw = zDiff * 140; // Tunable constant

        // PITCH
        // Nose Y position relative to Ear Y line
        const midEarY = (leftEar.y + rightEar.y) / 2;
        const noseY = nose.y;
        const pitchDiff = (midEarY - noseY);
        // If nose is higher than ears (smaller Y), looking UP.
        // If nose is lower than ears (larger Y), looking DOWN.
        const pitch = pitchDiff * 140;

        return { yaw, pitch, roll };
    }

    private determineZone(pose: Pose): TargetZone | null {
        const { yaw } = pose;
        const tolerance = 15;

        // Center: 0 +/- 15
        if (Math.abs(yaw) < 15) return 'center';

        // Left: Positive Yaw (User turns head Left, nose moves Left? Wait.
        // If I turn left, my left ear goes back, right ear comes forward.
        // leftEar.z (bigger/pos) - rightEar.z (smaller/neg)?
        // MP Z is negative in front of canvas?
        // Let's rely on visual calibration.
        // Assuming Positive Yaw = Turn Left (Standard)

        if (yaw > 20 && yaw < 45) return 'left-30';
        if (yaw < -20 && yaw > -45) return 'right-30';

        if (yaw >= 50) return 'left-profile';
        if (yaw <= -50) return 'right-profile';

        return null; // Transition or undefined
    }

    private onResults(results: Results) {
        const { width, height } = this.canvas;

        // Reset transform to clear
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, width, height);

        let targetScale = 1.0;
        let targetCx = width / 2;
        let targetCy = height / 2;
        let pose: Pose = { yaw: 0, pitch: 0, roll: 0 };
        let currentZone: TargetZone | null = null;
        let score = 0;
        let message = "Scanning...";

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceFound = true;
            const landmarks = results.multiFaceLandmarks[0];

            // 1. Calculate Pose
            pose = this.calculatePose(landmarks, width, height);
            currentZone = this.determineZone(pose);

            // 2. Calculate Face Height (Invariant Scale)
            // Top: 10, Bottom: 152
            const top = landmarks[10];
            const bottom = landmarks[152];
            const hDx = (top.x - bottom.x) * width;
            const hDy = (top.y - bottom.y) * height;
            const faceHeightPx = Math.sqrt(hDx * hDx + hDy * hDy);

            // Goal: faceHeight = canvasHeight * Ratio
            const desiredHeightPx = height * this.targetFaceHeightRatio;
            targetScale = desiredHeightPx / (faceHeightPx + 1);
            // Clamp scale
            targetScale = Math.max(1.0, Math.min(targetScale, 5.0));

            // 3. Face Center (Nose Bridge - Landmark 6)
            const nose = landmarks[6];
            targetCx = nose.x * width;
            targetCy = nose.y * height;

            // 4. Distance (Iris) - For user feedback mainly
            const lIris = landmarks[468];
            const rIris = landmarks[473];
            const irisDx = rIris.x - lIris.x;
            const irisDy = rIris.y - lIris.y;
            const irisDist = Math.sqrt(irisDx * irisDx + irisDy * irisDy);
            const approxDist = 4.0 / (irisDist + 0.001); // Heuristic
            this.distance = Math.round(approxDist);

            if (this.distance < 50) message = "Too close!";
            else if (this.distance > 90) message = "Too far!";
            else message = this.faceFound ? "Hold steady" : "Look at camera";

            score = 0.9; // Base score for detecting face

            // 5. Stability Logic
            const now = performance.now();
            if (currentZone && currentZone === this.lastZone) {
                const elapsed = now - this.zoneEnterTime;
                this.stabilityProgress = Math.min(100, (elapsed / this.STABILITY_THRESHOLD_MS) * 100);
            } else {
                this.lastZone = currentZone;
                this.zoneEnterTime = now;
                this.stabilityProgress = 0;
            }

        } else {
            this.faceFound = false;
            targetScale = 1.0;
            targetCx = width / 2;
            targetCy = height / 2;
            this.stabilityProgress = 0;
            message = "No face";
        }

        // 6. Smoothing (Lerp)
        const alpha = 0.15;
        this.currentScale = this.currentScale * (1 - alpha) + targetScale * alpha;
        this.currentCx = this.currentCx * (1 - alpha) + targetCx * alpha;
        this.currentCy = this.currentCy * (1 - alpha) + targetCy * alpha;

        // 7. Draw
        this.ctx.save();
        this.ctx.translate(width / 2, height / 2); // To Center
        this.ctx.scale(-this.currentScale, this.currentScale); // Mirror & Zoom
        this.ctx.translate(-this.currentCx, -this.currentCy); // To Face

        this.ctx.drawImage(results.image, 0, 0, width, height);

        // Optional: Debug landmarks (Only visible if we want)
        // if (this.faceFound) {
        //      const nose = results.multiFaceLandmarks[0][6];
        //      this.ctx.fillStyle = "rgba(0,255,255,0.5)";
        //      this.ctx.beginPath();
        //      this.ctx.arc(nose.x * width, nose.y * height, 5 / this.currentScale, 0, 2 * Math.PI);
        //      this.ctx.fill();
        // }

        this.ctx.restore();

        // 8. Callbacks
        if (this.onFrameProcessed) {
            this.onFrameProcessed({
                distance: this.distance,
                faceFound: this.faceFound,
                message,
                scaleFactor: this.currentScale,
                score,
                pose,
                currentZone,
                isStable: this.stabilityProgress >= 100,
                progress: this.stabilityProgress
            });
        }
    }

    public takePhoto(): Promise<Blob | null> {
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png', 1.0);
        });
    }
}
