import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const maxDuration = 55

const TIME_BUDGET_MS = 40000
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

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const isScheduled = searchParams.get("scheduled") === "1"

  if (isScheduled) {
    const easternHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date())
    )
    if (easternHour !== 9) {
      return NextResponse.json({
        skipped: true,
        reason: "Not 9am Eastern (currently " + easternHour + ":00 ET)",
      })
    }
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
        allSets.push({
          category: cat.id,
          region: cat.region,
          setId: s.id,
          setName: s.name,
          setAbbr: s.abbreviation,
        })
      }
    }
  }

  if (allSets.length === 0) {
    return NextResponse.json({ error: "Could not fetch set lists" }, { status: 500 })
  }

  const { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("id", "cards_sync_tcg")
    .single()

  let index = state?.last_set_index ?? 0
  if (index >= allSets.length) index = 0

  const startTime = Date.now()
  const seenIds = new Set()

  const setsProcessed = []
  const setsSkipped = []
  const errors = []
  let cardsSynced = 0
  let duplicatesSkipped = 0
  let passesCompleted = 0

  async function saveCursor(i) {
    const { error } = await supabase.from("sync_state").upsert({
      id: "cards_sync_tcg",
      last_set_index: i,
      last_run_at: new Date().toISOString(),
    })
    if (error) errors.push("sync_state upsert: " + error.message)
  }

  while (Date.now() - startTime < TIME_BUDGET_MS) {
    if (index >= allSets.length) {
      index = 0
      passesCompleted++
    }

    const set = allSets[index]
    const label = set.region + ":" + set.setName

    let [cardsJson, pricingJson, skusJson] = await Promise.all([
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/cards`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/pricing`),
      fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/skus`),
    ])

    if (!pricingJson?.prices) {
      // Retry once — many failures here are transient network blips, not permanent issues with the set itself.
      pricingJson = await fetchJSON(`${BASE}/${set.category}/sets/${set.setId}/pricing`)
    }

    const products = cardsJson?.products || []

    if (products.length === 0) {
      setsSkipped.push(label + " (no products returned)")
    } else if (!pricingJson?.prices) {
      setsSkipped.push(label + " (pricing fetch failed - retries next pass)")
    } else {
      const prices = pricingJson.prices
      const skuProducts = skusJson?.products || {}
      const rows = []

      for (const p of products) {
        const cardId = "tcg" + set.category + "-" + p.id

        if (seenIds.has(cardId)) {
          duplicatesSkipped++
          continue
        }
        seenIds.add(cardId)

        const tcg = prices[String(p.id)]?.tcg || {}

        rows.push({
          id: cardId,
          name: p.name,
          set_name: p.set_name || set.setName,
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
          price_1st_edition_holofoil:
            tcg["1st Edition Holofoil"]?.market ?? tcg["1st Edition"]?.market ?? null,
          raw_skus: skuProducts[String(p.id)] || null,
          synced_at: new Date().toISOString(),
        })
      }

      let setFailed = false

      for (const batch of chunk(rows, 500)) {
        const { error } = await supabase.from("cards").upsert(batch)
        if (error) {
          setFailed = true
          errors.push(label + " cards upsert: " + error.message)
          break
        }
        cardsSynced += batch.length
      }

      if (setFailed) {
        setsSkipped.push(label + " (upsert failed)")
      } else {
        setsProcessed.push(label)
      }
    }

    index++
    await saveCursor(index)
  }

  return NextResponse.json({
    setsProcessed,
    setsSkipped,
    errors,
    cardsSynced,
    duplicatesSkipped,
    nextIndex: index,
    totalSets: allSets.length,
    passesCompleted,
    elapsedMs: Date.now() - startTime,
  })
}