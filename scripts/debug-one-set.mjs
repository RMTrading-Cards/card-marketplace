import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const BASE = "https://openapi.tcgtracking.com/v1"
const CATEGORY = 3
const SET_ID = 24587 // ME03: Perfect Order, from your earlier sets listing

async function check(label, url) {
  try {
    const res = await fetch(url)
    console.log(`${label}: HTTP ${res.status}`)
    if (!res.ok) {
      const text = await res.text()
      console.log(`  Body: ${text.slice(0, 300)}`)
      return null
    }
    const json = await res.json()
    return json
  } catch (err) {
    console.log(`${label}: FAILED - ${err.message}`)
    return null
  }
}

async function run() {
  const cards = await check("cards", `${BASE}/${CATEGORY}/sets/${SET_ID}/cards`)
  console.log(`  products found: ${cards?.products?.length ?? "N/A"}`)

  const pricing = await check("pricing", `${BASE}/${CATEGORY}/sets/${SET_ID}/pricing`)
  console.log(`  prices keys: ${pricing?.prices ? Object.keys(pricing.prices).length : "N/A"}`)

  const skus = await check("skus", `${BASE}/${CATEGORY}/sets/${SET_ID}/skus`)
  console.log(`  sku products: ${skus?.products ? Object.keys(skus.products).length : "N/A"}`)
}

run()