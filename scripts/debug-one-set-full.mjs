import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE = "https://openapi.tcgtracking.com/v1"
const CATEGORY = 3
const REGION = "US"
const SET_ID = 24587

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) return null
  return await res.json()
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
  const cardsJson = await fetchJSON(`${BASE}/${CATEGORY}/sets/${SET_ID}/cards`)
  const pricingJson = await fetchJSON(`${BASE}/${CATEGORY}/sets/${SET_ID}/pricing`)
  const skusJson = await fetchJSON(`${BASE}/${CATEGORY}/sets/${SET_ID}/skus`)

  const products = cardsJson?.products || []
  const prices = pricingJson?.prices || {}
  const skuProducts = skusJson?.products || {}

  console.log(`Building ${products.length} rows...`)

  const rows = products.map((p) => {
    const tcg = prices[String(p.id)]?.tcg || {}
    return {
      id: `tcg${CATEGORY}-${p.id}`,
      name: p.name,
      set_name: p.set_name,
      set_id: String(SET_ID),
      card_number: p.number,
      set_total: products.length,
      rarity: p.rarity,
      image_small: p.image_url,
      image_large: p.image_url,
      region: REGION,
      set_abbr: p.set_abbr,
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

  console.log("First row sample:", JSON.stringify(rows[0], null, 2).slice(0, 800))

  const { data, error } = await supabase.from("cards").upsert(rows).select()

  if (error) {
    console.error("FULL ERROR:", JSON.stringify(error, null, 2))
  } else {
    console.log(`Success. Upserted ${data.length} rows.`)
  }
}

run()