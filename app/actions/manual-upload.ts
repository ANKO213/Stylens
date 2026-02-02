"use server";

import { createClient } from "@/utils/supabase/server";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";

export async function prepareManualUpload(folderName: string = "Avatar 1") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) return { error: "Unauthorized" };

    const prefix = `avatars/${user.email}/${folderName}/`;

    try {
        // 1. List existing files
        const listCmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix
        });
        const listRes = await r2.send(listCmd);

        // 2. Delete if any exist
        if (listRes.Contents && listRes.Contents.length > 0) {
            const objectsToDelete = listRes.Contents.map(obj => ({ Key: obj.Key }));
            const deleteCmd = new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: { Objects: objectsToDelete }
            });
            await r2.send(deleteCmd);
            console.log(`[Manual Upload] Cleared ${objectsToDelete.length} files from ${prefix}`);
        }

        return { success: true, folderName, email: user.email };

    } catch (error: any) {
        console.error("Failed to prepare upload folder:", error);
        return { error: "Failed to prepare storage" };
    }
}
