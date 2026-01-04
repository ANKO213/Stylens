"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize Admin Client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

interface CleanupReport {
    bucket: string;
    totalFiles: number;
    orphanedFiles: number;
    orphans: {
        path: string;
        url: string;
    }[];
}

// Helper to list all files in a bucket recursively
async function listAllFiles(bucket: string, path = ""): Promise<{ name: string; path: string }[]> {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(path, {
        limit: 1000,
        offset: 0,
    });

    if (error) {
        console.error(`Error listing ${bucket}/${path}:`, error);
        return [];
    }

    let files: { name: string; path: string }[] = [];

    for (const item of data) {
        if (item.id === null) {
            // It's a folder
            const subFiles = await listAllFiles(bucket, `${path ? path + '/' : ''}${item.name}`);
            files = [...files, ...subFiles];
        } else {
            // It's a file
            files.push({
                name: item.name,
                path: `${path ? path + '/' : ''}${item.name}`
            });
        }
    }
    return files;
}

export async function analyzeStorageCleanup() {
    try {
        const report: CleanupReport[] = [];

        // 1. Fetch ALL valid URLs from Database
        // Profiles (avatars)
        const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("avatar_url")
            .not("avatar_url", "is", null);

        // Styles (feed)
        const { data: styles } = await supabaseAdmin
            .from("styles")
            .select("image_url")
            .not("image_url", "is", null);

        // Generations
        const { data: generations } = await supabaseAdmin
            .from("generations")
            .select("image_url")
            .not("image_url", "is", null);

        // Normalize DB URLs Set
        const validUrls = new Set<string>();
        profiles?.forEach(p => p.avatar_url && validUrls.add(p.avatar_url.split('?')[0])); // Remove query params
        styles?.forEach(s => s.image_url && validUrls.add(s.image_url.split('?')[0]));
        generations?.forEach(g => g.image_url && validUrls.add(g.image_url.split('?')[0]));

        console.log(`[Storage Cleanup] Found ${validUrls.size} valid URLs in DB.`);

        // 2. Analyze 'avatars' bucket
        const avatarFiles = await listAllFiles("avatars");
        const avatarOrphans = [];

        for (const file of avatarFiles) {
            const publicUrl = `${PROJECT_URL}/storage/v1/object/public/avatars/${file.path}`;
            if (!validUrls.has(publicUrl)) {
                // Double check for encoded/decoded path issues? 
                // Supabase URLs are usually standard.
                avatarOrphans.push({ path: file.path, url: publicUrl });
            }
        }
        report.push({
            bucket: "avatars",
            totalFiles: avatarFiles.length,
            orphanedFiles: avatarOrphans.length,
            orphans: avatarOrphans
        });

        // 3. Analyze 'style-images' bucket
        // Note: Styles upload bucket name might vary. Assuming 'style-images' based on previous context or 'styles'.
        // Let's check if 'style-images' exists by trying list.
        const styleFiles = await listAllFiles("style-images"); // May need to verify bucket name
        const styleOrphans = [];

        for (const file of styleFiles) {
            const publicUrl = `${PROJECT_URL}/storage/v1/object/public/style-images/${file.path}`;
            if (!validUrls.has(publicUrl)) {
                styleOrphans.push({ path: file.path, url: publicUrl });
            }
        }
        report.push({
            bucket: "style-images",
            totalFiles: styleFiles.length,
            orphanedFiles: styleOrphans.length,
            orphans: styleOrphans
        });

        // 4. OLD 'generations' bucket? (If used in past)
        const genFiles = await listAllFiles("generations");
        const genOrphans = [];
        for (const file of genFiles) {
            const publicUrl = `${PROJECT_URL}/storage/v1/object/public/generations/${file.path}`;
            if (!validUrls.has(publicUrl)) {
                genOrphans.push({ path: file.path, url: publicUrl });
            }
        }
        if (genFiles.length > 0) {
            report.push({
                bucket: "generations",
                totalFiles: genFiles.length,
                orphanedFiles: genOrphans.length,
                orphans: genOrphans
            });
        }

        return { success: true, report };

    } catch (error: any) {
        console.error("Cleanup Analysis Error:", error);
        return { success: false, error: error.message };
    }
}

export async function executeStorageCleanup(filesToDelete: { bucket: string, path: string }[]) {
    try {
        if (!filesToDelete.length) return { success: true, count: 0 };

        const results = await Promise.all(
            filesToDelete.map(async (file) => {
                const { error } = await supabaseAdmin.storage
                    .from(file.bucket)
                    .remove([file.path]);
                return error ? 0 : 1;
            })
        );

        const deletedCount: number = results.reduce((a: number, b: number) => a + b, 0);
        return { success: true, count: deletedCount };

    } catch (error: any) {
        console.error("Cleanup Execution Error:", error);
        return { success: false, error: error.message };
    }
}
