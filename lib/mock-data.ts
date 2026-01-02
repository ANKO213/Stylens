export interface Pin {
    id: string;
    title: string;
    imageUrl: string;
    author: string;
    heightRatio: number;
    prompt: string;
}

const TOPICS = [
    "Nature", "Architecture", "Food", "Travel", "Art", "Technology", "Fashion", "Cars"
];

const UNSPLASH_IDS = [
    "1682687982501-1e58ab8147d7",
    "1682686853323-83f1e1c3196f",
    "1682695796954-6e16f8ef9201",
    "1682695795255-b23611384061",
    "1682687220742-aba13b6e0492",
    "1682687220888-c3d31a547285",
    "1682687220509-61b8a906ca19",
    "1682687220199-d7c5a611370f",
    "1682687220060-3f820508092a",
    "1682687219633-8d6973954f9a",
    "1682685797769-4828b17f54c9",
    "1682685797703-2947a61d763a",
    "1682685797274-1234567890ab", // Fake IDs for variety
    "1682685797123-abcdef123456"
];

export const SAFE_UNSPLASH_IMAGES = [
    "photo-1549880338-65ddcdfd017b",
    "photo-1511593358241-7eea1f3c84e5",
    "photo-1495474472287-4d71bcdd2085",
    "photo-1543353071-873f17a7a088",
    "photo-1543352634-9c15363b50c5",
    "photo-1543353071-087f9a7cebed",
    "photo-1560969184-10fe8719e654",
    "photo-1535930749574-1399327ce78f",
    "photo-1551963831-b3b1ca40c98e",
    "photo-1531297461136-82lw8e129e08",
    "photo-1504198458649-3128b932f49e",
    "photo-1533227297462-85dd5213d27e",
    "photo-1596003906949-79a952618995",
    "photo-1588625278786-2180556f082e",
    "photo-1577083552431-6e5fd01aa342"
];

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockPins(count: number = 20): Pin[] {
    return Array.from({ length: count }).map((_, i) => {
        const id = crypto.randomUUID();
        const width = 400;
        const height = getRandomInt(300, 800); // Random height for masonry effect
        const topic = TOPICS[getRandomInt(0, TOPICS.length - 1)];

        // Using simple Unsplash source URL which redirects to a random image of that topic/size
        // But fixed IDs are better for stability. Let's mix.
        const useSpecificId = Math.random() > 0.5;
        const unsplashId = UNSPLASH_IDS[getRandomInt(0, UNSPLASH_IDS.length - 1)];

        const imageUrl = useSpecificId
            ? `https://images.unsplash.com/photo-${unsplashId}?w=${width}&q=80&fit=crop`
            : `https://source.unsplash.com/random/${width}x${height}?${topic}&sig=${id}`;

        // Note: source.unsplash.com is deprecated/unreliable sometimes, let's use a reliable placeholder service or just specific IDs if possible.
        // Actually, let's stick to a robust way: picsum or just valid unsplash IDs.
        // For this demo, let's use a set of good Unsplash Image IDs to ensure they load.



        const safeImg = SAFE_UNSPLASH_IMAGES[getRandomInt(0, SAFE_UNSPLASH_IMAGES.length - 1)];
        const finalImageUrl = `https://images.unsplash.com/${safeImg}?q=80&w=${width}&auto=format&fit=crop`;

        return {
            id,
            title: `${topic} Inspiration ${getRandomInt(1, 100)}`,
            imageUrl: finalImageUrl,
            author: "User " + getRandomInt(1, 500),
            heightRatio: getRandomInt(300, 600) / 400,
            prompt: `A high quality professional photo of ${topic.toLowerCase()}, cinematic lighting, hyperrealistic, 8k.`
        };
    });
}
