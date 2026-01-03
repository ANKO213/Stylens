import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    // 1. Get Logged In User
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    const result = {
        user: { id: user?.id, email: user?.email },
        dbCount: 0,
        r2Count: 0,
        r2Files: [] as string[],
        dbFiles: [] as string[],
        error: null as string | null
    };

    if (!user) {
        return NextResponse.json({ error: "Not logged in" });
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
