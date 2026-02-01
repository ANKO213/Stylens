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

export class FaceCaptureModule {
    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private faceMesh: FaceMesh | null = null;
    private isRunning = false;
    private animationFrameId: number | null = null;
    private scriptLoaded = false;

    // Config
    // We want the face to occupy roughly this percentage of the screen width
    private targetFaceWidthRatio = 0.55;

    // State for smoothing (Kalman-ish / Lerp)
    private currentScale = 1.0;
    private currentCx = 0; // Smoothed Face Center X
    private currentCy = 0; // Smoothed Face Center Y

    // Logic state
    public distance: number = 0;
    public faceFound: boolean = false;
    public onFrameProcessed?: (stats: {
        distance: number;
        faceFound: boolean;
        message: string;
        scaleFactor: number;
        score: number;
    }) => void;

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

        // Fallback: If FaceMesh isn't ready or hasn't returned result yet, 
        // draw the raw video so the user doesn't see a black screen!
        if (!this.faceMesh) {
            const { width, height } = this.canvas;
            this.ctx.save();
            // Simple Mirror
            this.ctx.translate(width, 0);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.video, 0, 0, width, height);
            this.ctx.restore();

            // Draw "Loading AI..." text
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

    private onResults(results: Results) {
        const { width, height } = this.canvas;

        // Reset transform to clear
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, width, height);

        let targetScale = 1.0;
        let targetCx = width / 2;
        let targetCy = height / 2;

        let message = "Center your face";
        let score = 0;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceFound = true;
            const landmarks = results.multiFaceLandmarks[0];

            // 1. Calculate Face Scale
            const leftEar = landmarks[234];
            const rightEar = landmarks[454];

            const dx = (rightEar.x - leftEar.x) * width;
            const dy = (rightEar.y - leftEar.y) * height;
            const faceWidthPx = Math.sqrt(dx * dx + dy * dy);

            // Goal: faceWidthPx = width * Ratio
            const desiredWidthPx = width * this.targetFaceWidthRatio;
            targetScale = desiredWidthPx / (faceWidthPx + 1);
            targetScale = Math.max(1.0, Math.min(targetScale, 4.0));

            // 2. Face Center
            const nose = landmarks[6];
            targetCx = nose.x * width;
            targetCy = nose.y * height;

            // 3. Distance Calculation
            const lIris = landmarks[468];
            const rIris = landmarks[473];
            const irisDx = rIris.x - lIris.x;
            const irisDy = rIris.y - lIris.y;
            const irisDist = Math.sqrt(irisDx * irisDx + irisDy * irisDy);
            const approxDist = 4.0 / (irisDist + 0.001);
            this.distance = Math.round(approxDist);

            if (this.distance < 55) {
                message = "Move phone further away";
                score = 0.4;
            } else if (this.distance > 95) {
                message = "Move closer";
                score = 0.6;
            } else {
                message = "Perfect distance";
                score = 0.95;
            }

        } else {
            this.faceFound = false;
            // Slowly return to center/normal
            targetScale = 1.0;
            targetCx = width / 2;
            targetCy = height / 2;

            score = 0;
            message = "No face detected";
        }

        // 5. Smoothing (Lerp)
        const alpha = 0.15; // Smoothing factor
        this.currentScale = this.currentScale * (1 - alpha) + targetScale * alpha;
        this.currentCx = this.currentCx * (1 - alpha) + targetCx * alpha;
        this.currentCy = this.currentCy * (1 - alpha) + targetCy * alpha;

        // 6. Draw with Transforms
        this.ctx.save();

        // Order:
        // 1. Move Origin to Canvas Center (500, 500)
        this.ctx.translate(width / 2, height / 2);

        // 2. Apply Mirror AND Zoom
        // scale(-S, S) mirrors horizontally and zooms
        this.ctx.scale(-this.currentScale, this.currentScale);

        // 3. Move Origin to Face Center
        // We want the face center (currentCx, currentCy) to appear at the current origin (Canvas Center).
        // Since we are in Source coordinates (before Mirror flips), we translate by (-Cx, -Cy).
        this.ctx.translate(-this.currentCx, -this.currentCy);

        // Draw Video at (0,0)
        this.ctx.drawImage(results.image, 0, 0, width, height);

        // Debug Visuals (drawn in same space)
        if (this.faceFound && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            const nose = landmarks[6];
            // Draw dots at original source coordinates
            this.ctx.fillStyle = "cyan";
            this.ctx.beginPath();
            this.ctx.arc(nose.x * width, nose.y * height, 10 / this.currentScale, 0, 2 * Math.PI);
            this.ctx.fill();
        }

        this.ctx.restore();

        // 7. Callbacks
        if (this.onFrameProcessed) {
            this.onFrameProcessed({
                distance: this.distance,
                faceFound: this.faceFound,
                message,
                scaleFactor: this.currentScale,
                score
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
