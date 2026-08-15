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

function hammingDistance(hashA, hashB) {
  if (hashA.length !== hashB.length) return Infinity
  let distance = 0
  for (let i = 0; i < hashA.length; i++) {
    const a = parseInt(hashA[i], 16)
    const b = parseInt(hashB[i], 16)
    let xor = a ^ b
    while (xor) {
      distance += xor & 1
      xor >>= 1
    }
  }
  return distance
}

async function run() {
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, name, image_small")
    .not("image_small", "is", null)
    .limit(10)

  if (error) {
    console.error(error)
    return
  }

  console.log(`Hashing ${cards.length} sample cards...\n`)

  const hashed = []
  for (const card of cards) {
    try {
      const res = await fetch(card.image_small)
      const buffer = Buffer.from(await res.arrayBuffer())
      const tempPath = path.join(os.tmpdir(), `phash-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
      fs.writeFileSync(tempPath, buffer)

      const hash = await imghash.hash(tempPath, 16)
      fs.unlinkSync(tempPath)

      hashed.push({ ...card, hash })
      console.log(`${card.name}: ${hash}`)
    } catch (err) {
      console.log(`Failed to hash ${card.name}: ${err.message}`)
    }
  }

  console.log("\nPairwise distances (lower = more visually similar):")
  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      const dist = hammingDistance(hashed[i].hash, hashed[j].hash)
      console.log(`${hashed[i].name} vs ${hashed[j].name}: ${dist}`)
    }
  }
}

run()