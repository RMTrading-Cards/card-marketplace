import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
    .from("cards")
    .update({ image_phash: null })
    .eq("image_phash", "FAILED")
    .select("id")

  if (error) {
    console.error(error)
    return
  }

  console.log(`Reset ${data.length} previously-failed cards for a retry.`)
  console.log("Now run: node scripts\\backfill-phash.mjs")
}

run()