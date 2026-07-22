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

function pickPrice(tcg, preferredKeys) {
  if (!tcg) return null
  for (const key of preferredKeys) {
    for (const subtype of Object.keys(tcg)) {
      if (subtype.toLowerCase() === key.toLowerCase() && tcg[subtype]?.market != null) {
        return tcg[subtype].market
      }
    }
  }
  for (const subtype of Object.keys(tcg)) {
    if (tcg[subtype]?.market != null) return tcg[subtype].market
  }
  return null
}

async function run() {
  const allSets = []
  for (const cat of CATEGORIES) {
    const json = await fetchJSON(`${BASE}/${cat.id}/sets`)
    if (json?.sets) {
      for (const s of json.sets) {
        allSets.push({ category: cat.id, region: cat.region, setId: s.id, setName: s.name, setAbbr: s.abbreviation })
      }
    }
  }

  console.log(`Found ${allSets.length} total sets (US + JP)`)

  let totalSynced = 0

  for (const set of allSets) {
    const [cardsJson, pricingJson, skusJson] = await Promise.all([
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/cards`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/pricing`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/skus`),
    ])

    const products = cardsJson?.products || []
    if (products.length === 0) {
      console.log(`Skipping ${set.region}:${set.setName} (no cards)`)
      continue
    }

    const prices = pricingJson?.prices || {}
    const skuProducts = skusJson?.products || {}

    const rows = products.map((p) => {
      const tcg = prices[String(p.id)]?.tcg || {}
      return {
        id: `tcg${set.category}-${p.id}`,
        name: p.name,
        set_name: p.set_name,
        set_id: String(set.setId),
        card_number: p.number,
        set_total: products.length,
        rarity: p.rarity,
        image_small: p.image_url,
        image_large: p.image_url,
        region: set.region,
        set_abbr: p.set_abbr || set.setAbbr,
        tcgplayer_url: p.tcgplayer_url,
        tcgplayer_market_price: pickPrice(tcg, ["Holofoil", "Normal", "Reverse Holofoil"]),
        price_normal: tcg["Normal"]?.market ?? null,
        price_holofoil: tcg["Holofoil"]?.market ?? null,
        price_reverse_holofoil: tcg["Reverse Holofoil"]?.market ?? null,
        price_1st_edition_holofoil: tcg["1st Edition Holofoil"]?.market ?? tcg["1st Edition"]?.market ?? null,
        raw_skus: skuProducts[String(p.id)] || null,
        synced_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase.from("cards").upsert(rows)
    if (error) {
      console.error(`Error on ${set.region}:${set.setName}`, error.message)
    } else {
      totalSynced += rows.length
      console.log(`Synced ${set.region}:${set.setName} (${rows.length} cards) — running total: ${totalSynced}`)
    }
  }

  console.log(`Done. Total cards synced: ${totalSynced}`)
}

run()