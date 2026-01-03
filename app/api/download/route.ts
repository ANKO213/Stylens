
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    const filename = req.nextUrl.searchParams.get("filename") || "image.png";

    if (!url) {
        return new NextResponse("Missing URL", { status: 400 });
    }

    // Security: Ensure URL matches our R2 domain to prevent open proxy abuse
    // This is a basic check.
    const r2Domain = process.env.R2_PUBLIC_DOMAIN || "r2.dev";
    if (!url.includes(r2Domain) && !url.includes("r2.dev")) {
        // Allow if it's strictly from our known domains
        return new NextResponse("Invalid URL domain", { status: 403 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch image");

        const contentType = response.headers.get("content-type") || "image/png";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Download Proxy Error:", error);
        return new NextResponse("Failed to download image", { status: 500 });
    }
}
