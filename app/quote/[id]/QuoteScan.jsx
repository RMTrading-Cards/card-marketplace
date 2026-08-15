"use client"
import { useState, useRef, useEffect } from "react"
import { scanCardImage, addItemToQuote, getQuoteItems, removeQuoteItem } from "../../collection/actions"

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

const GRADE_OPTIONS = []
for (let g = 10; g >= 1; g -= 0.5) {
  GRADE_OPTIONS.push(g.toFixed(1))
}

function readAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader()
    reader.onload = function () { resolve(reader.result.split(",")[1]) }
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
    if (!base64 || base64.length < 1000) throw new Error("bad resize")
    return base64
  } catch (err) {
    return readAsBase64(file)
  }
}

function CandidateCard(props) {
  const card = props.card
  const quoteId = props.quoteId
  const onAdded = props.onAdded
  const [condition, setCondition] = useState("NM")
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [isGraded, setIsGraded] = useState(false)
  const [gradingCompany, setGradingCompany] = useState("PSA")
  const [gradeValue, setGradeValue] = useState("10.0")

  const variants = []
  if (card.price_normal != null) variants.push("Normal")
  if (card.price_holofoil != null) variants.push("Holofoil")
  if (card.price_reverse_holofoil != null) variants.push("Reverse Holofoil")
  if (card.price_1st_edition_holofoil != null) variants.push("1st Edition Holofoil")
  if (variants.length === 0) variants.push("Standard")

  const [variant, setVariant] = useState(variants[0])

  async function handleAdd() {
    setSubmitting(true)
    const formData = new FormData()
    formData.set("quote_session_id", quoteId)
    formData.set("card_id", card.id)
    formData.set("variant", variant)
    formData.set("condition", isGraded ? "NM" : condition)
    formData.set("quantity", quantity)
    formData.set("is_graded", isGraded ? "yes" : "no")
    if (isGraded) formData.set("grade_value", gradingCompany + " " + gradeValue)

    await addItemToQuote(formData)
    setSubmitting(false)
    onAdded()
  }

  return (
    <div style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 35%", maxWidth: 160 }}>
        {card.image_small && <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />}
      </div>
      <div style={{ flex: "1 1 55%", minWidth: 180, color: "#ffffff" }}>
        <strong>
          {card.region === "JP" ? "JP " : ""}{card.name}
          {card.card_number && card.set_total && <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>}
        </strong>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>{card.set_name}</div>

        <select value={variant} onChange={function (e) { setVariant(e.target.value) }} style={{ ...inputStyle, marginBottom: 6 }}>
          {variants.map(function (v) { return <option key={v} value={v}>{v}</option> })}
        </select>

        <div style={{ marginBottom: 6 }}>
          <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Graded?</div>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ color: "#ffffff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <input type="radio" checked={!isGraded} onChange={function () { setIsGraded(false) }} /> No
            </label>
            <label style={{ color: "#ffffff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <input type="radio" checked={isGraded} onChange={function () { setIsGraded(true) }} /> Yes
            </label>
          </div>
        </div>

        {isGraded ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select value={gradingCompany} onChange={function (e) { setGradingCompany(e.target.value) }} style={inputStyle}>
              <option value="PSA">PSA</option>
              <option value="BGS">BGS</option>
              <option value="CGC">CGC</option>
              <option value="Other">Other</option>
            </select>
            <select value={gradeValue} onChange={function (e) { setGradeValue(e.target.value) }} style={inputStyle}>
              {GRADE_OPTIONS.map(function (g) { return <option key={g} value={g}>{g}</option> })}
            </select>
          </div>
        ) : (
          <select value={condition} onChange={function (e) { setCondition(e.target.value) }} style={{ ...inputStyle, marginBottom: 6 }}>
            <option value="NM">Near Mint</option>
            <option value="LP">Lightly Played</option>
            <option value="MP">Moderately Played</option>
            <option value="HP">Heavily Played</option>
            <option value="DMG">Damaged</option>
          </select>
        )}

        <select value={quantity} onChange={function (e) { setQuantity(Number(e.target.value)) }} style={{ ...inputStyle, marginBottom: 8 }}>
          {Array.from({ length: 10 }, function (_, i) { return i + 1 }).map(function (n) { return <option key={n} value={n}>Qty: {n}</option> })}
        </select>

        <button
          onClick={handleAdd}
          disabled={submitting}
          style={{ width: "100%", backgroundColor: "#F2B705", color: "#000", fontWeight: 600, borderRadius: 6, padding: "8px 12px", fontSize: 14, border: "none", cursor: submitting ? "default" : "pointer" }}
        >
          {submitting ? "Adding..." : "This is the card - Add to Quote"}
        </button>
      </div>
    </div>
  )
}

export default function QuoteScan({ quoteId }) {
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState("")
  const [addedItems, setAddedItems] = useState([])
  const [showQr, setShowQr] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    refreshItems()
  }, [])

  async function refreshItems() {
    const items = await getQuoteItems(quoteId)
    setAddedItems(items)
  }

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
    refreshItems()
  }

  async function handleRemove(itemId) {
    await removeQuoteItem(itemId)
    refreshItems()
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : ""

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ color: "#ffffff", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
          <span style={{ color: "#F2B705" }}>RMT</span>rading Cards - Get a Quote
        </h1>
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
          Scan your cards below. When you're done, show the QR code to get your quote.
        </p>

        {!imagePreview && (
          <label style={{ display: "block", backgroundColor: "#141414", border: "2px dashed #3a3a3a", borderRadius: 10, padding: "40px 20px", textAlign: "center", cursor: "pointer", marginBottom: 20 }}>
            <div style={{ color: "#F2B705", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Tap to Open Camera</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>or choose a photo from your gallery</div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
        )}

        {imagePreview && (
          <div style={{ marginBottom: 16 }}>
            <img src={imagePreview} alt="Scanned card" style={{ maxWidth: 240, borderRadius: 8, display: "block", marginBottom: 8 }} />
            <button
              onClick={function () { setImagePreview(null); setScanResult(null); setError(""); if (fileInputRef.current) fileInputRef.current.value = "" }}
              style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
            >
              Scan a Different Photo
            </button>
          </div>
        )}

        {scanning && <p style={{ color: "#ffffff" }}>Reading card...</p>}
        {error && <p style={{ color: "#f87171", marginBottom: 12 }}>{error}</p>}

        {scanResult && !scanning && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>
              Best guess: <strong style={{ color: "#ffffff" }}>{scanResult.name || "Unknown"}</strong>
              {scanResult.cardNumber && <span> - {scanResult.cardNumber}</span>}
            </p>
            {scanResult.candidates.length === 0 ? (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No matches found. Try a clearer photo.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {scanResult.candidates.map(function (card) {
                  return <CandidateCard key={card.id} card={card} quoteId={quoteId} onAdded={handleAdded} />
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 16, marginBottom: 20 }}>
          <h2 style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Cards in this quote ({addedItems.length})
          </h2>
          {addedItems.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 13 }}>No cards added yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {addedItems.map(function (item) {
                return (
                  <div key={item.id} style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 6, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ color: "#ffffff", fontSize: 13 }}>
                      {item.cards?.name} - Qty {item.quantity} - {item.is_graded ? item.grade_value : item.condition}
                    </div>
                    <button
                      onClick={function () { handleRemove(item.id) }}
                      style={{ backgroundColor: "#2a1414", color: "#f87171", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {addedItems.length > 0 && (
          <div style={{ textAlign: "center" }}>
            {!showQr ? (
              <button
                onClick={function () { setShowQr(true) }}
                style={{ backgroundColor: "#F2B705", color: "#000", fontWeight: 700, borderRadius: 8, padding: "12px 24px", fontSize: 15, border: "none", cursor: "pointer" }}
              >
                Done Scanning - Show My QR Code
              </button>
            ) : (
              <div style={{ backgroundColor: "#141414", border: "1px solid #F2B705", borderRadius: 10, padding: 20, display: "inline-block" }}>
                <p style={{ color: "#ffffff", fontSize: 14, marginBottom: 12 }}>Show this to the seller</p>
                <img
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(shareUrl)}
                  alt="QR code"
                  style={{ borderRadius: 6, backgroundColor: "#ffffff", padding: 8 }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}