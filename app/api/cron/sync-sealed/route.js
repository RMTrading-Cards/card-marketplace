import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const maxDuration = 30

const DAILY_CREDIT_BUDGET = 90

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: sets } = await supabase
    .from("distinct_sets")
    .select("set_name")
    .order("set_name")

  const setNames = (sets || []).map((s) => s.set_name).filter(Boolean)
  if (setNames.length === 0) {
    return NextResponse.json({ error: "No sets found in cards table" }, { status: 500 })
  }

  const { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("id", "sealed_sync")
    .single()

  let index = state?.last_set_index ?? 0
  let creditsUsed = 0
  const setsProcessed = []
  let totalSynced = 0

  while (creditsUsed < DAILY_CREDIT_BUDGET) {
    if (index >= setNames.length) {
      index = 0
      break
    }

    const setName = setNames[index]

    const res = await fetch(
      `https://www.pokemonpricetracker.com/api/v2/sealed-products?set=${encodeURIComponent(setName)}&limit=50`,
      { headers: { Authorization: `Bearer ${process.env.POKEMONPRICETRACKER_API_KEY}` } }
    )

    if (res.ok) {
      const json = await res.json()
      const products = json.data || []

      if (products.length > 0) {
        const rows = products.map((p) => ({
          id: p.id,
          tcgplayer_id: p.tcgPlayerId,
          name: p.name,
          set_id: p.setId,
          set_name: p.setName,
          product_type: p.productType || null,
          image_url: p.imageUrl,
          market_price: p.unopenedPrice,
          synced_at: new Date().toISOString(),
        }))
        await supabase.from("sealed_products").upsert(rows)
        totalSynced += rows.length
      }

      creditsUsed += json.metadata?.apiCallsConsumed?.total ?? 1
    } else {
      creditsUsed += 1
    }

    setsProcessed.push(setName)
    index++
  }

  await supabase
    .from("sync_state")
    .update({ last_set_index: index, last_run_at: new Date().toISOString() })
    .eq("id", "sealed_sync")

  return NextResponse.json({
    setsProcessed,
    productsSynced: totalSynced,
    creditsUsed,
    nextIndex: index,
    totalSets: setNames.length,
  })
}