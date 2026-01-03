"use server";

import { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function uploadFeedImage(formData: FormData) {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            throw new Error("No file uploaded");
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Clean filename
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniqueKey = `feed-styles/${Date.now()}-${filename}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: uniqueKey,
            Body: buffer,
            ContentType: file.type,
            // ACL: "public-read" // R2 bucket usually public via domain or worker
        });

        await r2.send(command);

        const publicUrl = `${R2_PUBLIC_DOMAIN}/${uniqueKey}`;
        console.log("Uploaded feed image to R2:", publicUrl);

        return { success: true, url: publicUrl, key: uniqueKey };

    } catch (error: any) {
        console.error("R2 Upload Error:", error);
        return { success: false, error: error.message };
    }
}
