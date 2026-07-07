import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const API_KEY = process.env.POKEMONTCG_API_KEY

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJSON(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "X-Api-Key": API_KEY } })

      if (!res.ok) {
        console.warn(`  Attempt ${attempt}: HTTP ${res.status} for ${url}`)
        await sleep(2000 * attempt)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        console.warn(`  Attempt ${attempt}: non-JSON response for ${url}`)
        await sleep(2000 * attempt)
        continue
      }

      return await res.json()
    } catch (err) {
      console.warn(`  Attempt ${attempt}: ${err.message}`)
      await sleep(2000 * attempt)
    }
  }
  console.error(`  Giving up on ${url} after ${retries} attempts`)
  return null
}

async function fetchSets() {
  const json = await fetchJSON("https://api.pokemontcg.io/v2/sets")
  return json?.data ?? []
}

async function fetchCardsForSet(setId, page = 1) {
  return fetchJSON(
    `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250`
  )
}

function toRow(card) {
  const prices = card.tcgplayer?.prices
  const marketPrice =
    prices?.holofoil?.market ??
    prices?.normal?.market ??
    prices?.reverseHolofoil?.market ??
    null
  const lowPrice = prices?.holofoil?.low ?? prices?.normal?.low ?? null

  return {
    id: card.id,
    name: card.name,
    set_name: card.set?.name,
    set_id: card.set?.id,
    card_number: card.number,
    price_normal: card.tcgplayer?.prices?.normal?.market ?? null,
    price_holofoil: card.tcgplayer?.prices?.holofoil?.market ?? null,
    price_reverse_holofoil: card.tcgplayer?.prices?.reverseHolofoil?.market ?? null,
    price_1st_edition_holofoil:
      card.tcgplayer?.prices?.["1stEditionHolofoil"]?.market ??
      card.tcgplayer?.prices?.["1stEdition"]?.market ?? null,
    set_total: card.set?.printedTotal,
    release_year: card.set?.releaseDate?.slice(0, 4),
    rarity: card.rarity,
    image_small: card.images?.small,
    image_large: card.images?.large,
    tcgplayer_market_price: marketPrice,
    tcgplayer_low_price: lowPrice,
    tcgplayer_updated_at: card.tcgplayer?.updatedAt ?? null,
    raw_data: card,
    synced_at: new Date().toISOString(),
  }
}

async function run() {
  const sets = await fetchSets()
  console.log(`Found ${sets.length} sets`)

  for (const set of sets) {
    let page = 1
    while (true) {
      const result = await fetchCardsForSet(set.id, page)

      if (!result || !result.data || result.data.length === 0) {
        if (!result) console.error(`Skipping ${set.id} page ${page} — repeated failures`)
        break
      }

      const rows = result.data.map(toRow)
      const { error } = await supabase.from("cards").upsert(rows)
      if (error) console.error(`Error upserting set ${set.id}:`, error)
      else console.log(`Synced ${set.id} page ${page} (${rows.length} cards)`)

      if (page * result.pageSize >= result.totalCount) break
      page++

      await sleep(300)
    }
  }

  console.log("Sync complete")
}

run()
