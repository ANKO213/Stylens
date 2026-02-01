
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

    public async start(streamAlreadyActive = false) {
        if (this.isRunning) return;

        try {
            await this.initFaceMesh();
        } catch (e) {
            console.error("Failed to load FaceMesh", e);
            throw new Error("Failed to load facial recognition engine");
        }

        this.isRunning = true;

        if (!streamAlreadyActive) {
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
            } catch (e) {
                console.error("Camera failed", e);
                this.isRunning = false;
                throw e;
            }
        }

        // Start Loop
        this.processFrame();
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
            // Iris (468, 473) width in normalized coordinates (0-1)
            const leftEye = landmarks[468];
            const rightEye = landmarks[473];
            const dx = rightEye.x - leftEye.x;
            const dy = rightEye.y - leftEye.y;
            const irisWidth = Math.sqrt(dx * dx + dy * dy);

            // Heuristic: Distance ~ Constant / irisWidth
            // Let's calibrate: 
            // At 50cm (arm bent), irisWidth ~ 0.08? (depends on FOV)
            // K = 50 * 0.08 = 4.0

            const rawDistance = 4.0 / (irisWidth + 0.001);

            // Smooth distance to prevent jitter
            this.distance = this.distance * 0.8 + rawDistance * 0.2;

            // 2. Dynamic Scaling ("Lens Hack")
            // Goal: Keep face roughly same size on screen regardless of distance.
            // If user is at 50cm, scale = 1.0
            // If user is at 100cm, scale = 2.0

            // Reference distance we want to emulate (e.g. 50cm proximity look, but physically far)
            const referenceDistance = 45;

            // Calculate scale
            scaleFactor = this.distance / referenceDistance;

            // Clamp strictly
            scaleFactor = Math.max(1.0, Math.min(scaleFactor, 3.0));

            // 3. Guidance logic
            // We want them FAR away to get the telephoto compression
            if (this.distance < 60) {
                message = "Move phone further away"; // Too close => Wide angle distortion
                score = 0.4;
            } else if (this.distance > 90) {
                message = "Move closer"; // Too far => Resolution loss
                score = 0.6;
            } else {
                message = "Perfect. Hold still.";
                score = 0.95;
            }

        } else {
            this.faceFound = false;
            // Slowly reset scale if face lost
            scaleFactor = 1.0;
            this.distance = 0;
            message = "No face detected";
            score = 0;
        }

        if (this.onFrameProcessed) {
            this.onFrameProcessed({
                distance: Math.round(this.distance),
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
