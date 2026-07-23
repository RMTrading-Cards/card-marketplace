import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const maxDuration = 55

const DAILY_TIME_BUDGET_MS = 50000
const BASE = "https://openapi.tcgtracking.com/v1"
const CATEGORIES = [
  { id: 3, region: "US" },
  { id: 85, region: "JP" },
]

async function fetchJSON(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const allSets = []
  for (const cat of CATEGORIES) {
    const json = await fetchJSON(`${BASE}/${cat.id}/sets`)
    if (json?.sets) {
      for (const s of json.sets) {
        allSets.push({ category: cat.id, region: cat.region, setId: s.id, setName: s.name })
      }
    }
  }

  if (allSets.length === 0) {
    return NextResponse.json({ error: "Could not fetch set lists" }, { status: 500 })
  }

  const { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("id", "sealed_sync_tcg")
    .single()

  let index = state?.last_set_index ?? 0
  const startTime = Date.now()
  const setsProcessed = []
  let totalSynced = 0

  while (Date.now() - startTime < DAILY_TIME_BUDGET_MS) {
    if (index >= allSets.length) {
      index = 0
      break
    }
    const set = allSets[index]

    const [sealedJson, pricingJson] = await Promise.all([
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/sealed`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/pricing`),
    ])

    const products = sealedJson?.products || []
    if (products.length > 0) {
      const prices = pricingJson?.prices || {}

      const rows = products.map((p) => {
        const tcg = prices[String(p.id)]?.tcg || {}
        let market = null
        for (const subtype of Object.keys(tcg)) {
          if (tcg[subtype]?.market != null) {
            market = tcg[subtype].market
            break
          }
        }
        return {
          id: `tcg${set.category}-sealed-${p.id}`,
          tcgplayer_id: String(p.id),
          name: p.name,
          set_id: String(set.setId),
          set_name: p.set_name || set.setName,
          product_type: null,
          image_url: p.image_url,
          region: set.region,
          tcgplayer_url: p.tcgplayer_url,
          market_price: market,
          synced_at: new Date().toISOString(),
        }
      })

      const { error } = await supabase.from("sealed_products").upsert(rows)
      if (!error) totalSynced += rows.length
    }

    setsProcessed.push(`${set.region}:${set.setName}`)
    index++
  }

  await supabase
    .from("sync_state")
    .upsert({ id: "sealed_sync_tcg", last_set_index: index, last_run_at: new Date().toISOString() })

  return NextResponse.json({
    setsProcessed,
    productsSynced: totalSynced,
    nextIndex: index,
    totalSets: allSets.length,
  })
}