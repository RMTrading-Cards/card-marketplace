import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const maxDuration = 30

const DAILY_CREDIT_BUDGET = 90
const PAGE_SIZE = 90

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("id", "sealed_sync")
    .single()

  let offset = state?.last_set_index ?? 0
  let creditsUsed = 0
  let totalSynced = 0
  let totalCount = null

  while (creditsUsed < DAILY_CREDIT_BUDGET) {
    const res = await fetch(
      `https://www.pokemonpricetracker.com/api/v2/sealed-products?minPrice=0&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${process.env.POKEMONPRICETRACKER_API_KEY}` } }
    )

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: "Fetch failed", status: res.status, body, offset }, { status: 500 })
    }

    const json = await res.json()
    const products = json.data || []
    totalCount = json.metadata?.total ?? totalCount

    if (products.length === 0) {
      offset = 0
      break
    }

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

    creditsUsed += json.metadata?.apiCallsConsumed?.total ?? products.length
    offset += PAGE_SIZE

    if (!json.metadata?.hasMore) {
      offset = 0
      break
    }
  }

  await supabase
    .from("sync_state")
    .update({ last_set_index: offset, last_run_at: new Date().toISOString() })
    .eq("id", "sealed_sync")

  return NextResponse.json({
    productsSynced: totalSynced,
    creditsUsed,
    nextOffset: offset,
    totalCount,
  })
}