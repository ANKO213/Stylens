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

    // Fetch all styles
    const { data: styles, error } = await supabase
        .from("styles")
        .select("id, prompt");

    if (error) {
        console.error("Error fetching styles:", error);
        return;
    }

    console.log(`Found ${styles.length} styles. Processing updates...`);

    const NEW_TECHNICAL_NOTES = "The aesthetics of an iPhone shot, but without the facial distortion caused by the iPhone lens. A highly detailed and photorealistic image. Use ControlNet (OpenPose/Depth) to accurately reproduce the pose of a person sitting with a whiteboard. Generate the character's appearance (face, lips, ears, cheekbones, chin, eyes, eyebrows, hair, and body type) based on IP-Adapter or ReActor, using a user reference photo to achieve 1000% similarity. --ar Instagram post size 3:4";

    let updatedCount = 0;
    let errorCount = 0;

    for (const style of styles) {
        try {
            // Check if prompt is JSON
            let promptData;
            if (typeof style.prompt === "object" && style.prompt !== null) {
                promptData = style.prompt; // Already parsed by Supabase
            } else if (typeof style.prompt === "string") {
                try {
                    // Sanitize: remove possible NBSP or invisible chars
                    const cleanJson = style.prompt.replace(/\u00A0/g, " ");
                    promptData = JSON.parse(cleanJson);
                } catch (e) {
                    // Try even more aggressive cleaning if simple parse fails
                    try {
                        // Fix potential smart quotes if present (though invalid in JSON)
                        const cleaner = style.prompt.replace(/[\u201C\u201D]/g, '"').replace(/\u00A0/g, " ");
                        promptData = JSON.parse(cleaner);
                    } catch (e2) {
                        console.log(`[Skip] ID ${style.id} is not valid JSON string.`);
                        continue;
                    }
                }
            } else {
                console.log(`[Skip] ID ${style.id} has unknown type: ${typeof style.prompt}`);
                continue;
            }

            if (promptData && typeof promptData === "object" && promptData.technical_notes) {
                // Check if update is needed
                if (promptData.technical_notes === NEW_TECHNICAL_NOTES) {
                    console.log(`[Skip] ID ${style.id} already updated.`);
                    continue;
                }

                // Update
                promptData.technical_notes = NEW_TECHNICAL_NOTES;
                const newPromptStr = JSON.stringify(promptData, null, 2);

                const { error: updateError } = await supabase
                    .from("styles")
                    .update({ prompt: newPromptStr })
                    .eq("id", style.id);

                if (updateError) {
                    console.error(`[Error] Failed to update ID ${style.id}:`, updateError.message);
                    errorCount++;
                } else {
                    console.log(`[Success] Updated ID ${style.id}`);
                    updatedCount++;
                }
            } else {
                console.log(`[Skip] ID ${style.id} has no technical_notes field.`);
            }

        } catch (err) {
            console.error(`[Fatal Error] processing ID ${style.id}:`, err);
            errorCount++;
        }
    }

    console.log(`Done. Updated: ${updatedCount}. Errors: ${errorCount}.`);
}

main();
