import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"
import { Jimp, intToRGBA } from "jimp"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function computeHash(buffer) {
  const image = await Jimp.read(buffer)
  image.resize({ w: 9, h: 8 })
  image.greyscale()

  let bits = ""
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = intToRGBA(image.getPixelColor(x, y)).r
      const right = intToRGBA(image.getPixelColor(x + 1, y)).r
      bits += left < right ? "1" : "0"
    }
  }

  let hex = ""
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.substr(i, 4), 2).toString(16)
  }
  return hex
}

async function hashCard(card) {
  try {
    const res = await fetch(card.image_small)
    if (!res.ok) {
      console.log(`  Fetch failed for ${card.id}: HTTP ${res.status}`)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    return await computeHash(buffer)
  } catch (err) {
    console.log(`  Error hashing ${card.id}: ${err.message}`)
    return null
  }
}

async function run() {
  let totalDone = 0
  let totalFailed = 0
  const batchSize = 200

  while (true) {
    const { data: cards, error } = await supabase
      .from("cards")
      .select("id, image_small")
      .not("image_small", "is", null)
      .is("image_phash", null)
      .limit(batchSize)

    if (error) {
      console.error(error)
      break
    }
    if (!cards || cards.length === 0) break

    console.log(`Processing batch of ${cards.length}... (done so far: ${totalDone})`)

    const concurrency = 10
    for (let i = 0; i < cards.length; i += concurrency) {
      const chunk = cards.slice(i, i + concurrency)
      const results = await Promise.all(
        chunk.map(async (card) => ({ id: card.id, hash: await hashCard(card) }))
      )

      for (const r of results) {
        const valueToStore = r.hash || "FAILED"
        const { error: updateError } = await supabase
          .from("cards")
          .update({ image_phash: valueToStore })
          .eq("id", r.id)
        if (updateError || !r.hash) totalFailed++
        else totalDone++
      }
    }
  }

  console.log(`\nDone. Hashed: ${totalDone}, Failed: ${totalFailed}`)
}

run()