"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize Admin Client
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

export async function getUserGenerations(email: string | undefined, userId: string) {
    try {
        const pathsToCheck: string[] = [];
        if (email) pathsToCheck.push(email);
        if (userId) pathsToCheck.push(userId);

        const uniquePaths = Array.from(new Set(pathsToCheck));

        // Parallel fetch
        const promises = uniquePaths.map(path =>
            supabaseAdmin.storage
                .from('generations')
                .list(path, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' },
                })
                .then(({ data, error }) => ({ path, data, error }))
        );

        const results = await Promise.all(promises);
        let allFiles: any[] = [];

        results.forEach(({ path, data, error }) => {
            if (error) {
                console.error(`Error fetching images from ${path}:`, error);
                return;
            }
            if (data) {
                const mapped = data.map(file => ({ ...file, folderPath: path }));
                allFiles = [...allFiles, ...mapped];
            }
        });

        // Generate Public URLs
        const loadedImages = allFiles.map(file => {
            const { data: { publicUrl } } = supabaseAdmin.storage
                .from('generations')
                .getPublicUrl(`${file.folderPath}/${file.name}`);

            return {
                id: file.id || `${file.folderPath}-${file.name}`,
                url: publicUrl,
                title: file.name,
                created_at: file.created_at
            };
        });

        // Sort by date desc
        loadedImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { success: true, images: loadedImages };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}
