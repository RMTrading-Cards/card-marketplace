import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const API_KEY = process.env.GOOGLE_VISION_API_KEY

const TEST_IMAGE_URL = "https://cdn.tcgtracking.com/product/642450_400w.jpg"

async function runOCR(imageUrl) {
  const res = await fetch(
    "https://vision.googleapis.com/v1/images:annotate?key=" + API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    }
  )
  return res.json()
}

function parseCard(visionResponse) {
  const annotations = visionResponse.responses?.[0]?.textAnnotations
  if (!annotations || annotations.length === 0) {
    return { name: null, cardNumber: null, allText: [] }
  }

  const words = annotations.slice(1)

  const numberPattern = /^([A-Z]{0,3}\d+)\/([A-Z]{0,3}\d+)$/
  let cardNumber = null
  for (const word of words) {
    const match = word.description.match(numberPattern)
    if (match) {
      cardNumber = word.description
      break
    }
  }

  const STAGE_WORDS = new Set([
    "BASIC", "STAGE", "EX", "GX", "V", "VMAX", "VSTAR", "MEGA", "TAG", "TEAM"
  ])

  const allY = words.map((w) => w.boundingPoly?.vertices?.[0]?.y ?? 0)
  const minY = Math.min.apply(null, allY)
  const maxY = Math.max.apply(null, allY)
  const topThird = minY + (maxY - minY) * 0.35

  let bestWord = null
  let bestHeight = 0
  for (const word of words) {
    const verts = word.boundingPoly?.vertices || []
    const y = verts[0]?.y ?? Infinity
    if (y > topThird) continue
    if (word.description.length < 3) continue
    if (STAGE_WORDS.has(word.description.toUpperCase())) continue
    if (/^\.?\d+([.,]\d+)?$/.test(word.description)) continue

    const ys = verts.map((v) => v.y ?? 0)
    const height = Math.max.apply(null, ys) - Math.min.apply(null, ys)
    if (height > bestHeight) {
      bestHeight = height
      bestWord = word
    }
  }

  return {
    name: bestWord ? bestWord.description : null,
    cardNumber: cardNumber,
    allText: words.map((w) => w.description),
  }
}

async function run() {
  console.log("Running OCR on: " + TEST_IMAGE_URL + "\n")
  const result = await runOCR(TEST_IMAGE_URL)

  if (result.responses && result.responses[0] && result.responses[0].error) {
    console.error("Vision API error:", result.responses[0].error)
    return
  }

  const parsed = parseCard(result)
  console.log("Parsed name guess:", parsed.name)
  console.log("Parsed card number:", parsed.cardNumber)
  console.log("\nAll detected text on card:")
  console.log(parsed.allText.join(" | "))
}

run()