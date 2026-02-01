"use server";

import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface CaptureSessionState {
    id: string;
    status: 'waiting' | 'scanning' | 'captured' | 'completed';
    imageUrl?: string; // Final high-res image
    createdAt: number;
}

const SESSION_TTL = 1000 * 60 * 15; // 15 minutes

import { networkInterfaces } from "os";

// ... existing imports

// Helper to find local LAN IP
function getLocalIp() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or string family: 'IPv4'
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                return net.address;
            }
        }
    }
    return "localhost";
}

// Create a new session for the desktop user
export async function createCaptureSession(): Promise<{ id: string; url: string }> {
    const id = crypto.randomUUID();
    const state: CaptureSessionState = {
        id,
        status: 'waiting',
        createdAt: Date.now()
    };

    // Save initial state
    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `sessions/${id}.json`,
        Body: JSON.stringify(state),
        ContentType: "application/json",
    }));

    // Determine Base URL
    // Determine Base URL
    // Priority: Env Var (if set) -> Local IP (if dev) -> Localhost
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    // In production, default to the real domain if env var is missing
    if (process.env.NODE_ENV === 'production' && !baseUrl) {
        baseUrl = "https://stylens.me";
    }

    // Dev Logic: If env var is localhost, try to upgrade to LAN IP for mobile support
    if (!baseUrl || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
        const localIp = getLocalIp();
        if (localIp && localIp !== "localhost") {
            baseUrl = `http://${localIp}:3000`;
        } else if (!baseUrl) {
            baseUrl = "http://localhost:3000";
        }
    }

    return {
        id,
        url: `${baseUrl}/smart-capture?session=${id}`
    };
}

// Mobile: Update status or set uploaded image
export async function updateSessionStatus(id: string, status: CaptureSessionState['status'], imageUrl?: string) {
    // Read current to preserve fields if needed, or just overwrite since simple state
    const state: CaptureSessionState = {
        id,
        status,
        imageUrl,
        createdAt: Date.now() // Update timestamp to keep alive?
    };

    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `sessions/${id}.json`,
        Body: JSON.stringify(state),
        ContentType: "application/json"
    }));
}

// Desktop: Poll for status
export async function getSessionStatus(id: string): Promise<CaptureSessionState | null> {
    try {
        const result = await r2.send(new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: `sessions/${id}.json`
        }));

        if (!result.Body) return null;

        const str = await result.Body.transformToString();
        return JSON.parse(str) as CaptureSessionState;
    } catch (e) {
        return null;
    }
}

// Mobile: Get presigned URL to upload the high-quality capture directly
export async function getCaptureUploadUrl(sessionId: string): Promise<{ url: string; key: string }> {
    const key = `captures/${sessionId}/${Date.now()}.png`;

    // Create presigned URL for PUT
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: 'image/png',
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min

    return { url, key };
}

// Mobile: Upload directly via Server Action (Bypasses CORS)
export async function uploadCaptureImage(sessionId: string, zone: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    // Use consistent naming: captures/{session}/{zone}.png
    const key = `captures/${sessionId}/${zone}.png`;

    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "image/png"
    }));

    return { success: true, key };
}
