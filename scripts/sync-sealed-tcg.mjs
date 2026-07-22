import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

async function run() {
  const allSets = []
  for (const cat of CATEGORIES) {
    const json = await fetchJSON(`${BASE}/${cat.id}/sets`)
    if (json?.sets) {
      for (const s of json.sets) {
        allSets.push({ category: cat.id, region: cat.region, setId: s.id, setName: s.name })
      }
    }
  }

  console.log(`Found ${allSets.length} total sets (US + JP)`)

  let totalSynced = 0

  for (const set of allSets) {
    const [sealedJson, pricingJson] = await Promise.all([
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/sealed`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/pricing`),
    ])

    const products = sealedJson?.products || []
    if (products.length === 0) continue

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
    if (error) {
      console.error(`Error on ${set.region}:${set.setName}`, error.message)
    } else {
      totalSynced += rows.length
      console.log(`Synced ${set.region}:${set.setName} (${rows.length} products) — running total: ${totalSynced}`)
    }
  }

  console.log(`Done. Total sealed products synced: ${totalSynced}`)
}

run()