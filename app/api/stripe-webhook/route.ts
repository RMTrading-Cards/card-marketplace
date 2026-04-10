import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing required server environment variables" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cardId = Number(session.metadata?.cardId);

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId metadata" }, { status: 400 });
    }

    const { data: card, error: fetchError } = await supabaseAdmin
      .from("cards")
      .select("id, quantity")
      .eq("id", cardId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch card:", fetchError);
      return NextResponse.json({ error: "Card lookup failed" }, { status: 500 });
    }

    const currentQty = Number(card.quantity ?? 0);

    if (currentQty > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("cards")
        .update({ quantity: currentQty - 1 })
        .eq("id", cardId);

      if (updateError) {
        console.error("Failed to decrement quantity:", updateError);
        return NextResponse.json({ error: "Inventory update failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}