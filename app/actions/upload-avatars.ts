"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function uploadAvatars(formData: FormData) {
    // 1. Authenticate User (Standard Client)
    const supabaseUserClient = await createServerClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user || !user.email) {
        return { error: "User not authenticated or email missing" };
    }

    const email = user.email;
    const userId = user.id;

    // 2. Initialize Admin Client (Bypass RLS for deletion/overwrite)
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
        const userFolder = `${userId}`;

        // 3. Cleanup: Delete ALL existing files in the user's folder
        const { data: existingFiles, error: listError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .list(userFolder);

        if (listError) {
            console.error("List Error:", listError);
            // Continue? Or fail? If we can't list, we probably can't delete. 
            // Might be empty if first time.
        }

        if (existingFiles && existingFiles.length > 0) {
            const filesToRemove = existingFiles.map(f => `${userFolder}/${f.name}`);
            const { error: removeError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .remove(filesToRemove);

            if (removeError) {
                console.error("Remove Error:", removeError);
                return { error: "Failed to cleanup old avatars" };
            }
        }

        // 4. Upload New Files
        const mainFile = formData.get("main") as File;
        const side1File = formData.get("side1") as File;
        const side2File = formData.get("side2") as File;

        if (!mainFile) {
            return { error: "Main profile photo is required" };
        }

        const uploadPromises = [];
        let mainAvatarUrl = "";

        // Function to handle single file upload
        const uploadFile = async (file: File, name: string) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            // const fileExt = file.name.split('.').pop();
            // const timestamp = Date.now();
            // const filename = `${prefix}-${timestamp}.${fileExt}`; // e.g. main-170000000.jpg

            // USE DETERMINISTIC NAMES (No extension needed if Content-Type is set, makes URL predictable)
            const filename = name;
            const filePath = `${userFolder}/${filename}`;

            const { error: uploadError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .upload(filePath, buffer, {
                    contentType: file.type,
                    upsert: true
                });

            if (uploadError) throw new Error(`Failed to upload ${filename}: ${uploadError.message}`);

            // Get Public URL
            const { data: { publicUrl } } = supabaseAdmin
                .storage
                .from(bucketName)
                .getPublicUrl(filePath);

            // Add cache bust for immediate UI update
            return `${publicUrl}?t=${Date.now()}`;
        };

        // Main
        uploadPromises.push(
            uploadFile(mainFile, "main").then(url => { mainAvatarUrl = url; })
        );

        // Side 1
        if (side1File) {
            uploadPromises.push(uploadFile(side1File, "side1"));
        }

        // Side 2
        if (side2File) {
            uploadPromises.push(uploadFile(side2File, "side2"));
        }

        await Promise.all(uploadPromises);

        // 5. Update Profile with Main Avatar URL
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: mainAvatarUrl })
            .eq("id", userId);

        if (profileError) {
            console.error("Profile Update Error:", profileError);
            return { error: "Failed to update profile" };
        }

        return { success: true, avatarUrl: mainAvatarUrl };

    } catch (error: any) {
        console.error("Upload Avatars Error:", error);
        return { error: error.message || "An unexpected error occurred" };
    }
}
