"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

// New specialized action: "I have uploaded these files to R2, please update DB and cleanup old ones"
export async function confirmAvatarUpload(uploadedKeys: string[]) {
    try {
        // 1. Authenticate
        const supabaseUserClient = await createServerClient();
        const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

        if (authError || !user || !user.email) return { error: "Unauthorized" };

        const email = user.email;
        const userId = user.id;

        // 2. Admin Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } = await import("@/lib/r2");
        const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");

        const folderPrefix = `avatars/${email}/`;
        console.log(`[ConfirmUpload] Processing for ${email}`);

        // 3. CLEANUP ORPHANS
        // List all files in folder
        const listCommand = new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: folderPrefix });
        const listResponse = await r2.send(listCommand);

        const allObjects = listResponse.Contents || [];
        const objectsToDelete = allObjects
            .filter(obj => obj.Key && !uploadedKeys.includes(obj.Key)) // Delete anything NOT in the new list
            .map(obj => ({ Key: obj.Key }));

        if (objectsToDelete.length > 0) {
            console.log(`[ConfirmUpload] Deleting ${objectsToDelete.length} old/orphaned files...`);
            await r2.send(new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: { Objects: objectsToDelete, Quiet: true }
            }));
        }

        // 4. DETERMINE MAIN URL
        // We assume "main" is one of the keys or we just pick the first valid one?
        // The frontend sends keys like "avatars/email/main", "avatars/email/side1"
        // so we look for the one containing "main".
        const mainKey = uploadedKeys.find(k => k.includes("main")) || uploadedKeys[0];

        if (!mainKey) return { error: "No main avatar found" };

        if (!R2_PUBLIC_DOMAIN) throw new Error("R2_PUBLIC_DOMAIN missing");
        const domain = R2_PUBLIC_DOMAIN.replace(/\/$/, "");
        const finalUrl = `${domain}/${mainKey}?t=${Date.now()}`;

        // 5. UPDATE DB
        const { error: dbError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: finalUrl })
            .eq("id", userId);

        if (dbError) throw dbError;

        console.log("[ConfirmUpload] Success. DB updated.");
        return { success: true, avatarUrl: finalUrl };

    } catch (error: any) {
        console.error("Confirm Upload Error:", error);
        return { error: error.message };
    }
}
