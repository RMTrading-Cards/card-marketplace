import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"
import imghash from "imghash"
import fs from "fs"
import path from "path"
import os from "os"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function hashCard(card) {
  try {
    const res = await fetch(card.image_small)
    if (!res.ok) {
      console.log(`  Fetch failed for ${card.id}: HTTP ${res.status}`)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const tempPath = path.join(os.tmpdir(), `phash-${card.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
    fs.writeFileSync(tempPath, buffer)
    const hash = await imghash.hash(tempPath, 16)
    fs.unlinkSync(tempPath)
    return hash
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