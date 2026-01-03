import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: any) { // Use Request but typed ANY for speed
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email");

    // 1. Get Logged In User OR Param
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    const targetEmail = emailParam || user?.email;
    const targetId = user?.id; // Needed for DB check if not fetching by email in DB (?)
    // Wait, generations table uses user_id. If we debug by email, we need to map email -> id.

    // Admin lookup for ID if using param
    let userId = targetId;
    if (emailParam && !targetId) {
        // We can't easily get ID from email via Admin API without specific permissions usually, 
        // but let's try 'listUsers' if we can or just rely on the user being logged in?
        // Actually, for my tool use, I can't log in.
        // So I will make the debug tool list GLOBAL counts if no user found, OR just list R2 files for a hardcoded bucket prefix if provided.
    }

    // Fallback: If no user, list R2 for the email param purely.

    const result = {
        user: { id: userId, email: targetEmail },
        dbCount: 0,
        r2Count: 0,
        r2Files: [] as string[],
        dbFiles: [] as string[],
        error: null as string | null,
        bucket: R2_BUCKET_NAME
    };

    if (!targetEmail) {
        return NextResponse.json({ error: "No user/email provided" });
    }

    try {
        // 2. Check DB (Skip if no ID)
        if (userId) {
            const { count, data: dbData, error: dbError } = await supabaseAdmin
                .from("generations")
                .select("image_url", { count: "exact" })
                .eq("user_id", userId);

            if (dbError) result.error = `DB Error: ${dbError.message}`;
            result.dbCount = count || 0;
            result.dbFiles = dbData?.map(d => d.image_url) || [];
        } else {
            // Try to find user by email in 'profiles' if possible?
            // Or just skip DB check for now and check R2
            result.error = "Checking R2 only (No User ID for DB check)";
        }

        // 3. Check R2
        const folderPrefix = `generations/${targetEmail}/`;
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: folderPrefix
        });

        const listResponse = await r2.send(listCommand);
        result.r2Count = listResponse.KeyCount || 0;
        result.r2Files = listResponse.Contents?.map(c => c.Key || "") || [];

    } catch (e: any) {
        result.error = e.message;
    }

    return NextResponse.json(result);
}

try {
    // 2. Check DB
    const { count, data: dbData, error: dbError } = await supabaseAdmin
        .from("generations")
        .select("image_url", { count: "exact" })
        .eq("user_id", user.id);

    if (dbError) throw dbError;
    result.dbCount = count || 0;
    result.dbFiles = dbData?.map(d => d.image_url) || [];

    // 3. Check R2
    const folderPrefix = `generations/${user.email}/`;
    const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: folderPrefix
    });

    const listResponse = await r2.send(listCommand);
    result.r2Count = listResponse.KeyCount || 0;
    result.r2Files = listResponse.Contents?.map(c => c.Key || "") || [];

} catch (e: any) {
    result.error = e.message;
}

return NextResponse.json(result);
}
