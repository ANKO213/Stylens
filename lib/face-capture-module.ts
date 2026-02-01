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
    private currentTx = 0;
    private currentTy = 0;

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
            // Mirroring for fallback too
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
        let targetTx = 0; // Relative translation
        let targetTy = 0;

        let message = "Center your face";
        let score = 0;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.faceFound = true;
            const landmarks = results.multiFaceLandmarks[0];

            // 1. Calculate Face Geometry in Pixels
            // Landmarks 454 (Left Ear) -> 234 (Right Ear) roughly defines face width
            const leftEar = landmarks[234];
            const rightEar = landmarks[454];

            const dx = (rightEar.x - leftEar.x) * width; // Pixel width on canvas if drawn 1:1
            const dy = (rightEar.y - leftEar.y) * height;
            const faceWidthPx = Math.sqrt(dx * dx + dy * dy);

            // 2. Target Scale Logic ("Real Face" / Dolly Zoom)
            // We want faceWidthPx to ALWAYS be (width * targetFaceWidthRatio)
            const desiredWidthPx = width * this.targetFaceWidthRatio;
            targetScale = desiredWidthPx / (faceWidthPx + 1); // Avoid div by 0

            // Clamp scale for sanity (1x to 4x)
            targetScale = Math.max(1.0, Math.min(targetScale, 4.0));

            // 3. Optical Centering
            // Find face center (nose bridge landmark 6)
            const nose = landmarks[6];
            const faceCx = nose.x * width;
            const faceCy = nose.y * height;

            // Target offset from center = (CanvasCenter - FaceCenter)
            targetTx = (width / 2) - faceCx;
            targetTy = (height / 2) - faceCy;

            // 4. Distance Calculation for User Feedback
            // Rough estimation
            // Iris width approach again for consistency in 'cm' metric
            const lIris = landmarks[468];
            const rIris = landmarks[473];
            const irisDx = rIris.x - lIris.x;
            const irisDy = rIris.y - lIris.y;
            const irisDist = Math.sqrt(irisDx * irisDx + irisDy * irisDy);
            const approxDist = 4.0 / (irisDist + 0.001); // K constant
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
            // Slowly return to normal
            targetScale = 1.0;
            targetTx = 0;
            targetTy = 0;
            score = 0;
            message = "No face detected";
        }

        // 5. Smoothing (Lerp)
        const alpha = 0.15; // Smoothing factor
        this.currentScale = this.currentScale * (1 - alpha) + targetScale * alpha;
        this.currentTx = this.currentTx * (1 - alpha) + targetTx * alpha;
        this.currentTy = this.currentTy * (1 - alpha) + targetTy * alpha;

        // 6. Draw with Transforms
        this.ctx.save();

        // Handle Mirroring + Centering + Zooming

        // 1. Move to Center of Canvas
        this.ctx.translate(width / 2, height / 2);

        // 2. Mirror Horizontally (around center)
        this.ctx.scale(-1, 1);

        // 3. Apply Zoom
        this.ctx.scale(this.currentScale, this.currentScale);

        // 4. Translate back to top-left relative corner...
        // BUT we also need to center the face.
        // The face is at (faceCx, faceCy) in the source image.
        // If we simply draw image at (-w/2, -h/2), center of image (w/2, h/2) is at 0,0 (canvas center).

        // We want (faceCx, faceCy) to be at 0,0.
        // So we translate (-faceCx, -faceCy).
        // Since we mirrored X, faceCx logic might be flipped? 
        // MediaPipe coords are 0-1 relative to image.
        // Mirroring flips the drawing, so left becomes right.
        // If we translate by (-faceCx, -faceCy) BEFORE mirroring, it moves the face to origin.
        // Let's think:
        // Ctx at Center.
        // Scale(-1, 1). X axis flipped.
        // Scale(Zoom).
        // Translate(-faceCx + w/2, -faceCy + h/2)? 

        // Let's use the smoothed Tx/Ty logic which was: Tx = (w/2 - faceCx).
        // If we translate by (Tx, Ty), we shift the image so face is at w/2.

        // Correct transform sequence for "Mirror + Zoom + Pan to Face":
        // T(w/2, h/2) -> S(zoom) -> S(-1, 1) -> T(-faceCx, -faceCy) ? No.

        // Let's do:
        // 1. Center origin: Translate(w/2, h/2)
        // 2. Mirror: Scale(-1, 1)
        // 3. Zoom: Scale(s, s)
        // 4. Move face to origin: Translate(width/2 - faceCx, width/2 - faceCy) -- wait, (w/2 - faceCx) IS Tx.
        // So Translate(Tx, Ty)?
        // BUT since we are mirrored/flipped X, a positive translation in X moves LEFT (visual right).
        // If face is at x=100 (left side), faceCx=100. Width=1000. Tx = 400.
        // If we move +400, it moves 'right' in source coords... which is 'left' in mirrored coords?
        // This is confusing. 

        // Alternative:
        // Calculate offset to move face center to (0,0).
        // offsetX = -faceCx
        // offsetY = -faceCy
        // Then draw image at (offsetX, offsetY), centered on face.
        // Ctx is at (w/2, h/2).

        const smoothedFaceCx = (width / 2) - this.currentTx;
        const smoothedFaceCy = (height / 2) - this.currentTy;

        // Move to center
        this.ctx.translate(width / 2, height / 2);
        this.ctx.scale(-1, 1); // Mirror
        this.ctx.scale(this.currentScale, this.currentScale); // Zoom

        // Translate such that face center is at (0,0).
        // Since we are mirrored, X coords are flipped.
        // Drawing image at (-width/2, -height/2) centers the IMAGE.
        // To center the FACE, we need to shift.
        // Shift amount: (width/2 - faceCx).

        // If we simply translate(-faceCx, -faceCy)? No, we need relative to center.
        // We need to draw the image such that (faceCx, faceCy) is at (0,0).
        // So drawImage(img, -faceCx, -faceCy).

        // Yes! 
        this.ctx.drawImage(results.image, -smoothedFaceCx, -smoothedFaceCy, width, height);

        // Debug Visuals (drawn in same space)
        if (this.faceFound && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            // Nose (4)
            const nose = landmarks[4];
            this.ctx.fillStyle = "cyan";
            this.ctx.beginPath();
            // Draw at (coord - faceCx), etc.
            // Or just use the original coords and let the transform handle it?
            // Since we used drawImage with offset, we must apply offset to landmarks too.
            const lx = nose.x * width - smoothedFaceCx;
            const ly = nose.y * height - smoothedFaceCy;

            this.ctx.arc(lx, ly, 10 / this.currentScale, 0, 2 * Math.PI); // Scale down dot
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
