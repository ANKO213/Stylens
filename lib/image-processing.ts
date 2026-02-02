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

    // Sample pixels (every 16th pixel for speed)
    for (let i = 0; i < pixels.length; i += 64) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Perceived brightness (standard luma)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += luma;
        histogram[Math.floor(luma)]++;
    }

    const avgBrightness = totalBrightness / (pixels.length / 64);

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

    // Downsample for speed? No, need precision. 
    // But we can skip pixels.
    let variance = 0;
    let activePixels = 0;

    const stride = 4; // Skip alpha
    const row = width * 4;

    // Laplacian Kernel (Simplified): 4*center - (up+down+left+right)

    // Skip borders and step by 2 to save CPU?
    for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
            const i = (y * width + x) * 4;

            // Just use Green channel for speed (Luma approx)
            const center = pixels[i + 1];
            const up = pixels[i + 1 - row];
            const down = pixels[i + 1 + row];
            const left = pixels[i + 1 - 4];
            const right = pixels[i + 1 + 4];

            const laplacian = Math.abs(up + down + left + right - 4 * center);
            variance += laplacian;
            activePixels++;
        }
    }

    return variance / activePixels;
}


// --- ITERATIVE ACCUMULATION (Memory Safe) ---

export class FrameAccumulator {
    private buffer: Float32Array;
    width: number;
    height: number;
    count: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.buffer = new Float32Array(width * height * 4); // ~132MB for 4K
        this.count = 0;
    }

    add(imageData: ImageData) {
        const len = imageData.data.length;
        if (len !== this.buffer.length) throw new Error("Dimension mismatch");

        for (let i = 0; i < len; i++) {
            this.buffer[i] += imageData.data[i];
        }
        this.count++;
    }

    getResult(): ImageData {
        if (this.count === 0) throw new Error("No frames accumulated");

        const len = this.buffer.length;
        const result = new Uint8ClampedArray(len);
        for (let i = 0; i < len; i++) {
            result[i] = this.buffer[i] / this.count;
        }
        return new ImageData(result, this.width, this.height);
    }

    dispose() {
        // Help GC?
        // @ts-ignore
        this.buffer = null;
    }
}


/**
 * Helper to convert ImageData back to Blob
 */
export async function imageDataToBlob(imageData: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get offscreen context");

    ctx.putImageData(imageData, 0, 0);

    // High quality export (JPEG 0.95)
    return await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.95
    });
}
