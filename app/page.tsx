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

    const CORRECT_STORAGE_URL = "https://dgsvyelmvhybhphdxnvk.supabase.co/storage/v1/object/public/style-images/styles/";

    const carouselImages = styles?.map(s => {
      // Logic: If URL is full (R2/Supabase), use it. If filename only, append Supabase path.
      if (s.image_url?.startsWith("http")) {
        return s.image_url;
      }
      const filename = s.image_url.split('/').pop();
      return `${CORRECT_STORAGE_URL}${filename}`;
    }) || [];

    return <Hero images={carouselImages.length > 0 ? carouselImages : undefined} />;
  }

  return (
    <div className="min-h-screen font-sans pt-24">
      <MasonryFeed />
    </div>
  );
}
