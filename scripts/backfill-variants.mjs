import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  let from = 0
  const pageSize = 500
  let updated = 0

  while (true) {
    const { data: rows, error } = await supabase
      .from("cards")
      .select("id, raw_data")
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(error)
      break
    }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      const prices = row.raw_data?.tcgplayer?.prices
      if (!prices) continue

      const update = {
        price_normal: prices.normal?.market ?? null,
        price_holofoil: prices.holofoil?.market ?? null,
        price_reverse_holofoil: prices.reverseHolofoil?.market ?? null,
        price_1st_edition_holofoil:
          prices["1stEditionHolofoil"]?.market ?? prices["1stEdition"]?.market ?? null,
      }

      if (Object.values(update).some((v) => v != null)) {
        await supabase.from("cards").update(update).eq("id", row.id)
        updated++
      }
    }

    console.log(`Processed batch at offset ${from}`)
    from += pageSize
  }

  console.log(`Done. Updated ${updated} cards with variant pricing.`)
}

run()
