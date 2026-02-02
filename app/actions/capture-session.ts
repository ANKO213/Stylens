"use server";

import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createClient } from "@/utils/supabase/server";

// ... existing imports

export interface CaptureSessionState {
    id: string;
    status: 'waiting' | 'scanning' | 'captured' | 'completed';
    imageUrl?: string; // Final high-res image
    createdAt: number;
    userEmail?: string;
}

import { networkInterfaces } from "os";

// Helper to find local LAN IP
function getLocalIp() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const id = crypto.randomUUID();
    const state: CaptureSessionState = {
        id,
        status: 'waiting',
        createdAt: Date.now(),
        userEmail: user?.email
    };

    // Save initial state
    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `sessions/${id}.json`,
        Body: JSON.stringify(state),
        ContentType: "application/json",
    }));

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
    const state: CaptureSessionState = {
        id,
        status,
        imageUrl,
        createdAt: Date.now()
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

// Mobile: Upload directly via Server Action (Bypasses CORS)
export async function uploadCaptureImage(sessionId: string, zone: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    // Retrieve session checking for email
    const sessionState = await getSessionStatus(sessionId);
    if (!sessionState) throw new Error("Invalid Session");

    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine Key:
    // If we have an email, save to permanent storage (overwriting old scans)
    // Else fallback to temp session folder
    let key = `captures/${sessionId}/${zone}.jpg`;

    if (sessionState.userEmail) {
        key = `avatars/${sessionState.userEmail}/scans/${zone}.jpg`;
    }

    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg"
    }));

    // If this is center, we might want to update the avatar logic or just let the desktop pulling handle it
    // The desktop will see 'captured' status and then can download from the new path if needed?
    // Actually, updateSessionStatus should probably point to this new URL if needed, 
    // BUT for now the 'status' polling on desktop might need to know WHERE to look.
    // For simplicity, let's just return the key so the client can update the session with it.

    return { success: true, key };
}
