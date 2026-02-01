"use server";

import { createClient } from "@/utils/supabase/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";

export async function getAvatarPresignedUrl(avatarId: string, fileName: string, contentType: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || !user.email) {
            return { error: "Unauthorized" };
        }

        const email = user.email;
        // Key: avatars/{email}/{avatarId}/{fileName}
        const key = `avatars/${email}/${avatarId}/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        // Expires in 5 minutes
        const signedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

        return { success: true, url: signedUrl, key: key };
    } catch (error: any) {
        console.error("Presign Error:", error);
        return { error: "Failed to generate upload URL" };
    }
}
