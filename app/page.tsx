import { createClient } from "@/utils/supabase/server";
import { MasonryFeed } from "@/components/feed/masonry-feed";
import { Hero } from "@/components/hero/hero";

export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is guest AND not explicitly browsing, show Hero
  if (!user && searchParams.browse !== 'true') {
    // Fetch dynamic images for the carousel
    const { data: styles } = await supabase
      .from('styles')
      .select('image_url')
      .order('created_at', { ascending: false })
      .limit(15);

    const carouselImages = styles?.map(s => s.image_url) || [];

    return <Hero images={carouselImages.length > 0 ? carouselImages : undefined} />;
  }

  return (
    <div className="min-h-screen font-sans pt-24">
      <MasonryFeed />
    </div>
  );
}
