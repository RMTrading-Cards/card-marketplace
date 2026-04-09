import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // or your sb_secret_... server key
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
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