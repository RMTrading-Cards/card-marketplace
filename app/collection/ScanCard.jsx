"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { scanCardImage, addCardToCollection } from "./actions"

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 16,
  boxSizing: "border-box",
}

function readAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader()
    reader.onload = function () {
      resolve(reader.result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function resizeAndEncode(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const maxDim = 1200
    let width = bitmap.width
    let height = bitmap.height

    if (width > height && width > maxDim) {
      height = Math.round(height * (maxDim / width))
      width = maxDim
    } else if (height > maxDim) {
      width = Math.round(width * (maxDim / height))
      height = maxDim
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(bitmap, 0, 0, width, height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    const base64 = dataUrl.split(",")[1]

    if (!base64 || base64.length < 1000) {
      throw new Error("Resize produced an empty or invalid image")
    }

    return base64
  } catch (err) {
    return readAsBase64(file)
  }
}
function CandidateCard(props) {
  const card = props.card
  const collectionId = props.collectionId
  const onAdded = props.onAdded
  const router = useRouter()
  const [condition, setCondition] = useState("NM")
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const variants = []
  if (card.price_normal != null) variants.push({ key: "Normal", price: card.price_normal })
  if (card.price_holofoil != null) variants.push({ key: "Holofoil", price: card.price_holofoil })
  if (card.price_reverse_holofoil != null) variants.push({ key: "Reverse Holofoil", price: card.price_reverse_holofoil })
  if (card.price_1st_edition_holofoil != null) variants.push({ key: "1st Edition Holofoil", price: card.price_1st_edition_holofoil })
  if (variants.length === 0) variants.push({ key: "Standard", price: card.tcgplayer_market_price })

  const [variant, setVariant] = useState(variants[0].key)

  async function handleAdd() {
    setSubmitting(true)
    const formData = new FormData()
    formData.set("card_id", card.id)
    formData.set("variant", variant)
    formData.set("condition", condition)
    formData.set("quantity", quantity)
    formData.set("purchase_price", purchasePrice)
    formData.set("collection_id", collectionId || "")
    await addCardToCollection(formData)
    setSubmitting(false)
    router.refresh()
    onAdded()
  }

  return (
    <div
      style={{
        backgroundColor: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 35%", maxWidth: 160 }}>
        {card.image_small && (
          <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />
        )}
      </div>
      <div style={{ flex: "1 1 55%", minWidth: 180, color: "#ffffff" }}>
        <strong>
          {card.region === "JP" ? "JP " : ""}{card.name}
          {card.card_number && card.set_total && (
            <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
          )}
        </strong>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>{card.set_name}</div>

        <select value={variant} onChange={function (e) { setVariant(e.target.value) }} style={{ ...inputStyle, marginBottom: 6 }}>
          {variants.map(function (v) {
            return <option key={v.key} value={v.key}>{v.key}</option>
          })}
        </select>
        <select value={condition} onChange={function (e) { setCondition(e.target.value) }} style={{ ...inputStyle, marginBottom: 6 }}>
          <option value="NM">Near Mint</option>
          <option value="LP">Lightly Played</option>
          <option value="MP">Moderately Played</option>
          <option value="HP">Heavily Played</option>
          <option value="DMG">Damaged</option>
        </select>
        <select value={quantity} onChange={function (e) { setQuantity(Number(e.target.value)) }} style={{ ...inputStyle, marginBottom: 6 }}>
          {Array.from({ length: 10 }, function (_, i) { return i + 1 }).map(function (n) {
            return <option key={n} value={n}>Qty: {n}</option>
          })}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Your purchase price"
          value={purchasePrice}
          onChange={function (e) { setPurchasePrice(e.target.value) }}
          style={{ ...inputStyle, marginBottom: 8 }}
        />

        <button
          onClick={handleAdd}
          disabled={submitting}
          className="rmt-btn"
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 14,
            border: "none",
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Adding..." : "This is the card - Add to Collection"}
        </button>
      </div>
    </div>
  )
}

export default function ScanCard(props) {
  const collectionId = props.collectionId
  const onAdded = props.onAdded
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState("")
  const fileInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return

    setError("")
    setScanResult(null)
    setImagePreview(URL.createObjectURL(file))
    setScanning(true)

    try {
      const base64 = await resizeAndEncode(file)
      const result = await scanCardImage(base64)
      setScanResult(result)
    } catch (err) {
      setError(err.message || "Something went wrong scanning this card")
    } finally {
      setScanning(false)
    }
  }

  function handleAdded() {
    setImagePreview(null)
    setScanResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onAdded()
  }

  function handleScanAnother() {
    setImagePreview(null)
    setScanResult(null)
    setError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Scan a Card
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
        Take a clear, well-lit photo of the card. Works best held flat with the whole card in frame.
      </p>

      {!imagePreview && (
        <label
          style={{
            display: "block",
            backgroundColor: "#141414",
            border: "2px dashed #3a3a3a",
            borderRadius: 10,
            padding: "40px 20px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ color: "#F2B705", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Tap to Open Camera
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>or choose a photo from your gallery</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
      )}

      {imagePreview && (
        <div style={{ marginBottom: 16 }}>
          <img src={imagePreview} alt="Scanned card" style={{ maxWidth: 240, borderRadius: 8, display: "block", marginBottom: 8 }} />
          <button
            onClick={handleScanAnother}
            className="rmt-tab"
            style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
          >
            Scan a Different Photo
          </button>
        </div>
      )}

      {scanning && <p style={{ color: "#ffffff" }}>Reading card...</p>}

      {error && <p style={{ color: "#f87171", marginBottom: 12 }}>{error}</p>}

      {scanResult && !scanning && (
        <div>
          <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>
            Best guess: <strong style={{ color: "#ffffff" }}>{scanResult.name || "Unknown"}</strong>
            {scanResult.cardNumber && <span> - {scanResult.cardNumber}</span>}
          </p>
          {scanResult.detectedNonLatin && (
            <p style={{ color: "#F2B705", fontSize: 12, marginBottom: 12 }}>
              Detected non-English text — card names in our database are stored in English, so matching relies on visual similarity only for this scan.
            </p>
          )}

          {scanResult.candidates.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
              No matches found. Try a clearer photo, or use the regular Add Cards search instead.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scanResult.candidates.map(function (card) {
                return (
                  <CandidateCard
                    key={card.id}
                    card={card}
                    collectionId={collectionId}
                    onAdded={handleAdded}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}