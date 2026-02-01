import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const R2_BUCKET = process.env.R2_BUCKET_NAME;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const token = formData.get("token") as string;
        const userId = formData.get("userId") as string;
        const pose = (formData.get("pose") as string) || "unknown";

        if (!token || !userId) {
            return NextResponse.json({ error: "Missing token or userId" }, { status: 401 });
        }

        const files = Array.from(formData.entries()).filter(([key, entry]) => entry instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        const uploadPromises = files.map(async ([key, entry]) => {
            const file = entry as File;
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name;

            // Organized Structure: avatars/{userId}/scan_latest/{pose}/{filename}
            // This allows the AI generator to always find 'front/rgb.jpg' easily.
            const r2Path = `avatars/${userId}/scan_latest/${pose}/${fileName}`;

            // 1. Upload to R2 (Cloud)
            const r2Command = new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: r2Path,
                Body: buffer,
                ContentType: file.type,
            });
            const r2Upload = r2.send(r2Command);

            // 2. Save Locally (for Debugging on PC)
            // Save to: project_root/scans_test/{userId}/{pose}/{filename}
            const localDir = path.join(process.cwd(), "scans_test", userId, pose);
            await mkdir(localDir, { recursive: true });
            const localPath = path.join(localDir, fileName);
            const localSave = writeFile(localPath, buffer);

            return Promise.all([r2Upload, localSave]);
        });

        await Promise.all(uploadPromises);

        return NextResponse.json({ success: true, count: files.length, saved_locally: true });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
