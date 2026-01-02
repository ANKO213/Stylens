export const PLAN_CREDITS: Record<string, number> = {
    "price_1SiFMtKn9kCv0rqZuqPasJqA": 600, // €2.99 Starter
    "price_1SiFRkKn9kCv0rqZ5jxrdwnm": 3500, // €14.99 Creator
    "price_1SiFUBKn9kCv0rqZg6VmXXfz": 12000     // €49.99 Pro Studio
};

export const STRIPE_PLANS = [
    {
        id: "starter",
        priceId: "price_1SiFMtKn9kCv0rqZuqPasJqA",
        name: "Starter Pack",
        price: 2.99,
        credits: 600,
        description: "Perfect for beginners"
    },
    {
        id: "creator",
        priceId: "price_1SiFRkKn9kCv0rqZ5jxrdwnm",
        name: "Creator Pack",
        price: 14.99,
        credits: 3500,
        description: "Best for consistent creators",
        isPopular: true
    },
    {
        id: "pro",
        priceId: "price_1SiFUBKn9kCv0rqZg6VmXXfz",
        name: "Pro Studio",
        price: 49.99,
        credits: 12000,
        description: "Maximum power & speed"
    }
];
