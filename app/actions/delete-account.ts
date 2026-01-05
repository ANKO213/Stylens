"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

export async function deleteAccount() {
    // 1. Authenticate User
    const supabaseUserClient = await createServerClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user || !user.email) {
        return { success: false, error: "User not authenticated" };
    }

    const userId = user.id;
    const userEmail = user.email;

    console.log(`[DeleteAccount] Starting deletion for user: ${userEmail} (${userId})`);

    // 2. Initialize Admin Client (for Auth Deletion)
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
        // --- R2 CLEANUP ---

        // Helper to delete a folder prefix
        const deletePrefix = async (prefix: string) => {
            console.log(`[DeleteAccount] Scanning R2 prefix: ${prefix}`);
            let continuationToken: string | undefined = undefined;

            do {
                const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
                    Bucket: R2_BUCKET_NAME,
                    Prefix: prefix,
                    ContinuationToken: continuationToken
                });

                const listResponse = await r2.send(listCommand);

                if (listResponse.Contents && listResponse.Contents.length > 0) {
                    const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
                    console.log(`[DeleteAccount] Deleting ${objectsToDelete.length} files from ${prefix}`);

                    await r2.send(new DeleteObjectsCommand({
                        Bucket: R2_BUCKET_NAME,
                        Delete: {
                            Objects: objectsToDelete,
                            Quiet: true
                        }
                    }));
                }

                continuationToken = listResponse.NextContinuationToken;
            } while (continuationToken);
        };

        // A. Delete Avatars (avatars/{email}/)
        await deletePrefix(`avatars/${userEmail}/`);

        // B. Delete Generations (generations/{email}/)
        // Note: Based on generation route, we used email for folder structure
        await deletePrefix(`generations/${userEmail}/`);


        // --- DB CLEANUP ---
        // Deleting the user from auth.users will CASCADE to public.profiles and public.generations
        // provided the foreign keys are set up with ON DELETE CASCADE (checked in schema: yes).

        console.log(`[DeleteAccount] Deleting user from Supabase Auth`);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error("[DeleteAccount] Auth deletion failed:", deleteError);
            throw new Error("Failed to delete user account record");
        }

        console.log(`[DeleteAccount] Deletion successful`);
        return { success: true };

    } catch (error: any) {
        console.error("[DeleteAccount] Fatal Error:", error);
        return { success: false, error: error.message || "Failed to delete account" };
    }
}
