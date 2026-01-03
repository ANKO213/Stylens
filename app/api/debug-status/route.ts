import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: any) {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email");

    const result = {
        mode: emailParam ? "Specific User" : "Global Scan",
        targetEmail: emailParam || "None",
        userFoundInDB: false,
        dbCount: 0,
        r2Count: 0,
        r2Files: [] as string[],
        dbFiles: [] as string[],
        usersInR2: [] as string[],
        error: null as string | null
    };

    try {
        if (emailParam) {
            // Specific User Debug

            // 1. Check DB (We need a user ID for this, but we might not have it easily from email without admin access)
            // We'll try to get user details if logged in, otherwise we skip DB or do a fuzzy check if we can (we assume userId needed)
            // Actually, let's just List R2 for this email first.

            // Check R2 for this email
            const folderPrefix = `generations/${emailParam}/`;
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                Prefix: folderPrefix
            });
            const listResponse = await r2.send(listCommand);
            result.r2Count = listResponse.KeyCount || 0;
            result.r2Files = listResponse.Contents?.map(c => c.Key || "") || [];

            // Try to find user ID from DB by email (requires Admin)
            // Not exposed in standard Supabase client easily w/o schema, but we can try simple RPC or skipping.
            // Assume we can't check DB perfectly without ID, but we can report R2 status.

        } else {
            // Global Scan - List folders in 'generations/' to find users
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                Prefix: "generations/",
                Delimiter: "/"
            });
            const listResponse = await r2.send(listCommand);

            // CommonPrefixes contains folders
            result.usersInR2 = listResponse.CommonPrefixes?.map(cp => cp.Prefix || "") || [];
            result.r2Count = result.usersInR2.length;
        }

    } catch (e: any) {
        result.error = e.message;
    }

    return NextResponse.json(result);
}
