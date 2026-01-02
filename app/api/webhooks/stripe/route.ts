import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { PLAN_CREDITS } from "@/lib/stripe-config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as any,
});

// Admin Supabase Client (Service Role) to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed.`, err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;

                // 1. Get User ID from metadata
                const userId = session.metadata?.userId;
                if (!userId) {
                    console.error("[Checkout] No userId in session metadata!");
                    break;
                }

                // 2. Retrieve Subscription to get line items/price
                const subscriptionId = session.subscription as string;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const priceId = subscription.items.data[0].price.id;

                // 3. Determine Credits
                const credits = PLAN_CREDITS[priceId] || 0;

                console.log(`[Checkout] Processing for Price ID: ${priceId}`);
                console.log(`[Checkout] Mapped Credits: ${credits}`);

                if (credits === 0) {
                    console.warn(`[Checkout] WARNING: No credits mapped for Price ID ${priceId}. Check lib/stripe-config.ts`);
                }

                // 4. Update Profile
                const { error: updateError } = await supabaseAdmin
                    .from("profiles")
                    .update({
                        stripe_customer_id: session.customer as string,
                        subscription_status: "active",
                        credits: credits, // Updated to 'credits' column
                    })
                    .eq("id", userId);

                if (updateError) {
                    console.error(`[Checkout] DB Update Failed: ${updateError.message}`, updateError);
                } else {
                    console.log(`[Checkout] User ${userId} subscribed. Credits set to ${credits}. DB Updated.`);
                }
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object as Stripe.Invoice;

                // Check if this is a recurring renewal
                if (invoice.billing_reason === "subscription_cycle") {
                    const customerId = invoice.customer as string;

                    // 1. Find User by Customer ID
                    const { data: profile } = await supabaseAdmin
                        .from("profiles")
                        .select("id")
                        .eq("stripe_customer_id", customerId)
                        .single();

                    if (!profile) {
                        console.error(`[Renewal] No profile found for customer ${customerId}`);
                        break;
                    }

                    // 2. Get Price ID from Invoice Lines
                    const lineItem = invoice.lines.data[0];
                    const priceId = ((lineItem as any).price as Stripe.Price)?.id || ((lineItem as any).plan as Stripe.Plan)?.id;
                    const credits = PLAN_CREDITS[priceId] || 0;

                    // 3. RESET Credits (RPC Call)
                    // If RPC exists: await supabaseAdmin.rpc('reset_credits', { p_user_id: profile.id, p_amount: credits });
                    // Or direct Update if "Use it or lose it" effectively means = new amount
                    // Direct update is safer if RPC might be missing/permissions issues, 
                    // provided we want to overwrite existing balance completely.
                    // "Credit Logic: ... RESET to the plan's limit ... It does NOT accumulate."
                    // So direct update is actually correct for "Reset".

                    await supabaseAdmin
                        .from("profiles")
                        .update({
                            credits: credits,
                            subscription_status: "active" // Ensure active
                        })
                        .eq("id", profile.id);

                    console.log(`[Renewal] User ${profile.id} credits reset to ${credits}.`);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                await supabaseAdmin
                    .from("profiles")
                    .update({ subscription_status: "canceled" })
                    .eq("stripe_customer_id", customerId);

                console.log(`[Cancel] Subscription canceled for customer ${customerId}`);
                break;
            }

            default:
            // Unhandled event type
        }
    } catch (error: any) {
        console.error("Webhook handler failed:", error);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
