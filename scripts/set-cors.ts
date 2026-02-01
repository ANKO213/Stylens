import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

async function main() {
    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        console.error("Missing R2 credentials in .env.local");
        console.log("Keys found:", Object.keys(process.env).filter(k => k.includes("R2")));
        process.exit(1);
    }

    const r2 = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });

    console.log(`Setting CORS for bucket: ${R2_BUCKET_NAME}`);

    const command = new PutBucketCorsCommand({
        Bucket: R2_BUCKET_NAME,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["PUT", "POST", "GET", "HEAD", "DELETE"],
                    AllowedOrigins: ["*"], // Allow all for dev
                    ExposeHeaders: ["ETag"],
                    MaxAgeSeconds: 3600,
                },
            ],
        },
    });

    try {
        await r2.send(command);
        console.log("Successfully set CORS rules!");
    } catch (err) {
        console.error("Error setting CORS:", err);
    }
}

main();
