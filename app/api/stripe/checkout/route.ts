import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as any, // latest API version
});

export async function POST(req: NextRequest) {
    try {
        const { priceId } = await req.json();

        // 1. Authenticate User
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Get User Profile for Customer ID
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", user.id)
            .single();

        // 3. Create Checkout Session
        const sessionPayload: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${req.headers.get("origin")}/profile?success=true`,
            cancel_url: `${req.headers.get("origin")}/profile?canceled=true`,
            metadata: {
                userId: user.id,
            },
        };

        // If existing customer, reuse ID
        if (profile?.stripe_customer_id) {
            sessionPayload.customer = profile.stripe_customer_id;
        } else {
            // Otherwise, prefill email for new customer creation
            sessionPayload.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(sessionPayload);

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
