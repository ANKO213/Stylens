import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = {
        tableExists: false,
        insertTest: null as any,
        selectTest: null as any,
        error: null as any,
    };

    try {
        // 1. Check if we can select
        const { data: selectData, error: selectError } = await supabaseAdmin
            .from("generations")
            .select("*")
            .limit(1);

        if (selectError) {
            results.error = selectError;
        } else {
            results.tableExists = true;
            results.selectTest = selectData;
        }

        // 2. Introspect Schema (if possible via RPC or just guessing columns)
        // We will try an insert with all fields we expect
        // const { error: insertError } = await supabaseAdmin
        //     .from("generations")
        //     .insert({
        //         user_id: "debug-test",
        //         image_url: "https://example.com/test.png",
        //         prompt: "test",
        //         title: "debug",
        //         model: "debug"
        //     });
        // We skip insert to avoid pollution, unless user asks. 
        // We just want to see if select works and returns empty.

    } catch (e: any) {
        results.error = e.message;
    }

    return NextResponse.json(results);
}
