import { createClient } from "@/utils/supabase/server";
import { MasonryFeed } from "@/components/feed/masonry-feed";
import { Hero } from "@/components/hero/hero";
import { Metadata } from "next";

type Props = {
    params: Promise<{ slug: string }>;
};

// 1. Generate Metadata for Social Sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const slug = (await params).slug;
    const supabase = await createClient();

    // 1. Reverse Slugify: Convert "cool-photo" -> "cool photo"
    // Limitations: We strictly can't know original casing, but we'll try ILIKE match.
    // For better results, we search broadly.
    const searchTerm = slug.replace(/-/g, ' ');

    const { data: style } = await supabase
        .from("styles")
        .select("*")
        .ilike("title", searchTerm) // Case-insensitive match
        .limit(1)
        .single();

    if (!style) {
        return {
            title: "Stylens - AI Photo Studio",
            description: "Create professional AI photos efficiently."
        };
    }

    return {
        title: `${style.title} | Stylens`,
        description: `Create specific photos with the ${style.title} style on Stylens.`,
        openGraph: {
            images: [style.image_url],
            title: style.title,
            description: "Create AI photos in this style now."
        },
        twitter: {
            card: "summary_large_image",
            title: style.title,
            description: "Create AI photos in this style now.",
            images: [style.image_url],
        }
    };
}

export default async function StylePage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const supabase = await createClient();

    // 1. Find Style ID from Slug
    const searchTerm = params.slug.replace(/-/g, ' ');
    const { data: style } = await supabase
        .from("styles")
        .select("id")
        .ilike("title", searchTerm)
        .limit(1)
        .single();

    const initialPinId = style?.id;

    // 2. Reuse Home Page Layout Logic
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // If guest, normally we show Hero. BUT if they came via a specific link, 
    // we want them to see the Feed with the Item Open (so they can see what was shared).
    // So we skip Hero if a specific style was found.

    // HOWEVER, if style NOT found, maybe generic fallback?
    if (!user && !initialPinId) {
        // Fallback to Hero if valid link not found
        // Fetch carousel images... (copy logic from page.tsx or extract)
        // For brevity, just redirecting to home or showing base hero
        const { data: styles } = await supabase.from('styles').select('image_url').limit(15);
        const images = styles?.map((s: any) => s.image_url) || [];
        return <Hero images={images} />;
    }

    return (
        <div className="min-h-screen font-sans pt-24">
            <MasonryFeed initialPinId={initialPinId} />
        </div>
    );
}
