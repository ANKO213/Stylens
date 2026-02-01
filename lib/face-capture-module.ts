
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
    private idealDistanceMin = 50; // cm (approx arm length)
    private idealDistanceMax = 70;

    // State
    public distance: number = 0; // cm
    public brightness: number = 0;
    public faceFound: boolean = false;
    public isStable: boolean = false;
    public onFrameProcessed?: (stats: {
        distance: number;
        faceFound: boolean;
        message: string;
        scaleFactor: number;
        score: number; // 0-1 quality score
    }) => void;

    constructor(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement) {
        this.video = videoEl;
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext("2d")!;
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

    public async start() {
        if (this.isRunning) return;

        try {
            await this.initFaceMesh();
        } catch (e) {
            console.error("Failed to load FaceMesh", e);
            throw new Error("Failed to load facial recognition engine");
        }

        this.isRunning = true;

        // Start Camera Manually
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error(
                    "Camera access is not supported in this browser or context. " +
                    "If you are on mobile, you MUST use HTTPS or localhost. " +
                    "HTTP on a local IP (192.168.x.x) is blocked by browser security."
                );
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

            // Start Loop
            this.processFrame();
        } catch (e) {
            console.error("Camera failed", e);
            this.isRunning = false;
            throw e;
        }
    }

    private async processFrame() {
        if (!this.isRunning || !this.faceMesh) return;

        if (this.video.readyState >= 2) {
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
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(results.image, 0, 0, width, height);

        let message = "Look at the camera";
        let score = 0;
        let scaleFactor = 1.0;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceFound = true;
            const landmarks = results.multiFaceLandmarks[0];

            // 1. Calculate approximate distance
            // Iris landmarks: 468 (L), 473 (R)
            const leftEye = landmarks[468]; // center of left iris
            const rightEye = landmarks[473]; // center of right iris

            const dx = rightEye.x - leftEye.x;
            const dy = rightEye.y - leftEye.y;
            const pixelDist = Math.sqrt(dx * dx + dy * dy); // Normalized 0-1

            // Heuristic Function for Distance (in cm)
            this.distance = Math.round(5 / pixelDist);

            // 2. Dynamic Scaling (The "Lens Hack")
            scaleFactor = Math.max(1.0, this.distance / 40); // Base 40cm. 
            if (scaleFactor > 2.0) scaleFactor = 2.0; // Limit zoom

            // 3. Guidance
            if (this.distance < this.idealDistanceMin) {
                message = "Move phone further away";
                score = 0.3;
            } else if (this.distance > this.idealDistanceMax) {
                message = "Move closer";
                score = 0.5;
            } else {
                message = "Perfect distance";
                score = 0.9;
            }

        } else {
            this.faceFound = false;
            scaleFactor = 1.0;
            this.distance = 0;
            message = "No face detected";
            score = 0;
        }

        if (this.onFrameProcessed) {
            this.onFrameProcessed({
                distance: this.distance,
                faceFound: this.faceFound,
                message,
                scaleFactor,
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
