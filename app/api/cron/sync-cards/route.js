import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const maxDuration = 60

const API_KEY = process.env.POKEMONTCG_API_KEY

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJSON(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "X-Api-Key": API_KEY } })
      if (!res.ok) {
        await sleep(1000 * attempt)
        continue
      }
      const contentType = res.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        await sleep(1000 * attempt)
        continue
      }
      return await res.json()
    } catch (err) {
      await sleep(1000 * attempt)
    }
  }
  return null
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

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const startTime = Date.now()
  const TIME_BUDGET_MS = 50000

  const { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("id", "cards_sync")
    .single()

  const setsJson = await fetchJSON("https://api.pokemontcg.io/v2/sets")
  const sets = setsJson?.data ?? []

  if (sets.length === 0) {
    return NextResponse.json({ error: "Could not fetch sets list" }, { status: 500 })
  }

  let index = state?.last_set_index ?? 0
  const setsProcessed = []

  while (Date.now() - startTime < TIME_BUDGET_MS) {
    if (index >= sets.length) {
      index = 0
      break
    }

    const set = sets[index]
    let page = 1

    while (true) {
      const result = await fetchJSON(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${set.id}&page=${page}&pageSize=250`
      )
      if (!result || !result.data || result.data.length === 0) break

      const rows = result.data.map(toRow)
      await supabase.from("cards").upsert(rows)

      if (page * result.pageSize >= result.totalCount) break
      page++

      if (Date.now() - startTime > TIME_BUDGET_MS) break
    }

    setsProcessed.push(set.id)
    index++

    if (Date.now() - startTime > TIME_BUDGET_MS) break
  }

  await supabase
    .from("sync_state")
    .update({ last_set_index: index, last_run_at: new Date().toISOString() })
    .eq("id", "cards_sync")

  return NextResponse.json({
    setsProcessed,
    nextIndex: index,
    totalSets: sets.length,
  })
}
