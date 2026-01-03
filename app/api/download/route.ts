import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || "download.png";

    if (!url) {
        return NextResponse.json({ error: "Missing URL param" }, { status: 400 });
    }

    // Security: Only allow internal R2 domains or known domains if strictness is needed
    // For now, we assume the client sends valid image URLs. 
    // Ideally check if url.startsWith(R2_PUBLIC_DOMAIN)

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const contentType = response.headers.get("Content-Type") || "image/png";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "public, max-age=3600"
            }
        });

    } catch (error: any) {
        console.error("Download Proxy Error:", error);
        return NextResponse.json({ error: "Failed to download image" }, { status: 500 });
    }
}
