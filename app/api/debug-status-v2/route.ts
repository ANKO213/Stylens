import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic'; // Force no cache

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
            // Check R2 for this email
            const folderPrefix = `generations/${emailParam}/`;
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                Prefix: folderPrefix
            });
            const listResponse = await r2.send(listCommand);
            result.r2Count = listResponse.KeyCount || 0;
            result.r2Files = listResponse.Contents?.map(c => c.Key || "") || [];

        } else {
            // Global Scan
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                Prefix: "generations/",
                Delimiter: "/"
            });
            const listResponse = await r2.send(listCommand);
            result.usersInR2 = listResponse.CommonPrefixes?.map(cp => cp.Prefix || "") || [];
            result.r2Count = result.usersInR2.length;
        }

    } catch (e: any) {
        result.error = e.message;
    }

    return NextResponse.json(result);
}
