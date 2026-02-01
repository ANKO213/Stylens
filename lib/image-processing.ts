export interface ProcessedFrame {
    data: ImageData;
    sharpness: number;
    brightness: number;
}

/**
 * Analyzes the brightness histogram of an image.
 * Returns true if the image is too dark (underexposed).
 */
export function analyzeLight(data: ImageData): { isLowLight: boolean; brightness: number } {
    const { width, height, data: pixels } = data;
    let totalBrightness = 0;
    const histogram = new Array(256).fill(0);

    // Sample pixels (every 4th pixel for speed)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Perceived brightness (standard luma)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += luma;
        histogram[Math.floor(luma)]++;
    }

    const avgBrightness = totalBrightness / (pixels.length / 16);

    // Low light threshold: Average brightness < 40 (out of 255)
    // Or check if significant portion is in shadow
    const isLowLight = avgBrightness < 45;

    return { isLowLight, brightness: avgBrightness };
}

/**
 * Calculates the sharpness of an image using a simplified Laplacian variance kernel.
 * Higher score = Sharper.
 */
export function calculateSharpness(data: ImageData): number {
    const { width, height, data: pixels } = data;

    // Grayscale buffer
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        // Simple average for speed
        gray[i / 4] = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    }

    let variance = 0;
    let activePixels = 0;

    // Laplacian Kernel: 
    //  0  1  0
    //  1 -4  1
    //  0  1  0

    // Skip borders
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;

            const center = gray[i];
            const up = gray[i - width];
            const down = gray[i + width];
            const left = gray[i - 1];
            const right = gray[i + 1];

            const laplacian = Math.abs(up + down + left + right - 4 * center);

            // Variance accumulation (simplified)
            variance += laplacian;
            activePixels++;
        }
    }

    return variance / activePixels;
}

/**
 * Stacks multiple frames to reduce noise (Temporal Denoising).
 * Averages pixel values across all valid frames.
 */
export function stackFrames(frames: ImageData[]): ImageData {
    if (frames.length === 0) throw new Error("No frames to stack");

    const width = frames[0].width;
    const height = frames[0].height;
    const len = frames[0].data.length;

    // 32-bit float buffer for accumulation to avoid overflow
    const accumulation = new Float32Array(len);

    // Stack
    for (const frame of frames) {
        for (let i = 0; i < len; i++) {
            accumulation[i] += frame.data[i];
        }
    }

    // Average
    const count = frames.length;
    const result = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i++) {
        result[i] = accumulation[i] / count;
    }

    return new ImageData(result, width, height);
}

/**
 * Helper to convert ImageData back to Blob
 */
export async function imageDataToBlob(imageData: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get offscreen context");

    ctx.putImageData(imageData, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
}
