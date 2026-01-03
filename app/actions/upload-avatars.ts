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

        // --- STRICT FOLDER ENFORCEMENT ---
        // We use Email as the folder name.
        const targetFolder = email;
        const legacyFolder = userId;

        // 3. CLEANUP PHASE
        // We act on both folders to ensure no residue from previous versions.
        const foldersToClean = [targetFolder, legacyFolder];

        for (const folder of foldersToClean) {
            // List files
            const { data: files, error: listError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .list(folder);

            if (listError) {
                console.error(`Cleanup List Error (${folder}):`, listError);
                continue;
            }

            if (files && files.length > 0) {
                const pathsToRemove = files
                    .filter(f => f.name !== '.emptyFolderPlaceholder')
                    .map(f => `${folder}/${f.name}`);

                if (pathsToRemove.length > 0) {
                    const { error: removeError } = await supabaseAdmin
                        .storage
                        .from(bucketName)
                        .remove(pathsToRemove);

                    if (removeError) {
                        console.error(`Cleanup Remove Error (${folder}):`, removeError);
                    }
                }
            }
        }

        // 4. UPLOAD PHASE (Sequential for safety)
        const mainFile = formData.get("main") as File;
        const side1File = formData.get("side1") as File;
        const side2File = formData.get("side2") as File;

        if (!mainFile) return { error: "Main photo is required" };

        let finalAvatarUrl = "";

        // Helper
        const processUpload = async (file: File, name: string) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = name; // Deterministic: "main", "side1", "side2"
            const filePath = `${targetFolder}/${fileName}`;

            // Upsert
            const { error: uploadError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .upload(filePath, buffer, {
                    contentType: file.type,
                    upsert: true
                });

            if (uploadError) throw new Error(`Upload failed for ${fileName}: ${uploadError.message}`);

            // Get URL
            const { data: { publicUrl } } = supabaseAdmin
                .storage
                .from(bucketName)
                .getPublicUrl(filePath);

            return publicUrl;
        };

        // A. Upload Main
        const mainUrl = await processUpload(mainFile, "main");
        finalAvatarUrl = `${mainUrl}?t=${Date.now()}`; // Add cache buster for DB

        // B. Upload Side 1 (if exists)
        if (side1File) {
            await processUpload(side1File, "side1");
        }

        // C. Upload Side 2 (if exists)
        if (side2File) {
            await processUpload(side2File, "side2");
        }

        // 5. UPDATE DB
        const { error: dbError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: finalAvatarUrl })
            .eq("id", userId);

        if (dbError) throw dbError;

        return { success: true, avatarUrl: finalAvatarUrl };

    } catch (error: any) {
        console.error("Upload Avatars Fatal Error:", error);
        return { error: error.message || "Server upload failed" };
    }
}
