import { S3Client } from "@aws-sdk/client-s3";

// User provided credentials
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "a802ea37f7f486078eea1f39a6c0e30d";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "7811e9f7a5bf950b212ac5d949f1e997";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "bd63339e1d4de8c555022971c4335430b468b04ff06829542087339882d4167e";

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "stylensimg";
export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-7910916370d44ba2875c0c6122ac584f.r2.dev";

export const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});
