"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function uploadAvatars(formData: FormData) {
    // 1. Authenticate User
    const supabaseUserClient = await createServerClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user || !user.email) {
        return { error: "User not authenticated or email missing" };
    }

    const email = user.email;
    const userId = user.id;

    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        const bucketName = "avatars";
        const targetFolder = email; // User requirement: Folder name is email

        console.log(`[AvatarUpload] Start. User: ${email}`);

        // 3. CLEANUP PHASE: "Clean Slate"
        // List everything in the user's folder
        const { data: existingFiles, error: listError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .list(targetFolder);

        if (listError) {
            console.error(`[AvatarUpload] List Error:`, listError);
            // We continue, assuming maybe folder doesn't exist yet
        }

        if (existingFiles && existingFiles.length > 0) {
            // Filter out placeholder if any
            const filesToDelete = existingFiles
                .filter(f => f.name !== '.emptyFolderPlaceholder')
                .map(f => `${targetFolder}/${f.name}`);

            if (filesToDelete.length > 0) {
                console.log(`[AvatarUpload] Cleaning up ${filesToDelete.length} old files...`);
                const { error: deleteError } = await supabaseAdmin
                    .storage
                    .from(bucketName)
                    .remove(filesToDelete);
                
                if (deleteError) {
                    console.error("Cleanup failed:", deleteError);
                    // Critical? Maybe not, upsert might handle it, but user wants strict cleanup.
                    // We'll log and proceed with upsert=true.
                } else {
                     console.log("[AvatarUpload] Cleanup successful.");
                }
            }
        }

        // 4. UPLOAD PHASE
        const mainFile = formData.get("main") as File;
        const side1File = formData.get("side1") as File;
        const side2File = formData.get("side2") as File;

        if (!mainFile) return { error: "Main photo is required" };

        let finalAvatarUrl = "";

        const processUpload = async (file: File, name: string) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = name; // Strict naming: "main", "side1", "side2"
            const filePath = `${targetFolder}/${fileName}`;
            
            console.log(`[AvatarUpload] Uploading ${name} to ${filePath}`);

            const { error: uploadError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .upload(filePath, buffer, {
                    contentType: file.type,
                    upsert: true
                });

            if (uploadError) throw new Error(`Upload failed for ${fileName}: ${uploadError.message}`);

            const { data: { publicUrl } } = supabaseAdmin
                .storage
                .from(bucketName)
                .getPublicUrl(filePath);
            
            return publicUrl;
        };

        // Upload Main
        const mainUrl = await processUpload(mainFile, "main");
        // Add cache buster for DB URL only (so frontend sees change immediately)
        finalAvatarUrl = `${mainUrl}?t=${Date.now()}`; 

        // Upload Sides
        if (side1File) await processUpload(side1File, "side1");
        if (side2File) await processUpload(side2File, "side2");

        // 5. UPDATE DB
        const { error: dbError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: finalAvatarUrl })
            .eq("id", userId);

        if (dbError) throw dbError;

        console.log("[AvatarUpload] Complete. DB updated.");
        return { success: true, avatarUrl: finalAvatarUrl };

    } catch (error: any) {
        console.error("Upload Avatars Fatal Error:", error);
        return { error: error.message || "Server upload failed" };
    }
}
