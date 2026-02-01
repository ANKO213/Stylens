import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error("Missing Supabase credentials");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: styles, error } = await supabase
        .from("styles")
        .select("id, prompt")
        .eq("id", "60dc77a8-32a8-4cb5-89ec-f73121982214")
        .single();

    if (!styles) return;
    const s = styles; // adapt to single object
    const list = [s];

    if (error) {
        console.error("Error fetching styles:", error);
        return;
    }

    console.log("Found styles:", list.length);
    list.forEach((s) => {
        console.log(`[${s.id}] Type: ${typeof s.prompt}`);
        if (typeof s.prompt === 'string') {
            try {
                JSON.parse(s.prompt);
                console.log("Valid JSON string");
            } catch (e) {
                console.log("Invalid JSON string:", e.message);
                console.log("Content slice:", s.prompt.slice(0, 50));
            }
        }
        // console.log(`[${s.id}] Prompt:`, s.prompt);
    });
}

main();
