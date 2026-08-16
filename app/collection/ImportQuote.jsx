"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import jsQR from "jsqr"
import { getQuoteItems, importQuoteAsCollection } from "./actions"

const inputStyle = {
  backgroundColor: "#0d0d0d",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 16,
  boxSizing: "border-box",
}

const GRADE_OPTIONS = []
for (let g = 10; g >= 1; g -= 0.5) {
  GRADE_OPTIONS.push(g.toFixed(1))
}

function getVariants(card) {
  const variants = []
  if (card.price_normal != null) variants.push("Normal")
  if (card.price_holofoil != null) variants.push("Holofoil")
  if (card.price_reverse_holofoil != null) variants.push("Reverse Holofoil")
  if (card.price_1st_edition_holofoil != null) variants.push("1st Edition Holofoil")
  if (variants.length === 0) variants.push("Standard")
  return variants
}

function EditableItem(props) {
  const item = props.item
  const onChange = props.onChange
  const card = item.cards
  const variants = card ? getVariants(card) : ["Standard"]

  return (
    <div style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 30%", maxWidth: 130 }}>
        {card?.image_small && <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />}
      </div>
      <div style={{ flex: "1 1 60%", minWidth: 200, color: "#ffffff" }}>
        <strong>{card?.name}</strong>{" "}
        <span style={{ color: "#9ca3af", fontSize: 12 }}>({card?.set_name})</span>

        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={item.variant} onChange={function (e) { onChange({ variant: e.target.value }) }} style={inputStyle}>
            {variants.map(function (v) { return <option key={v} value={v}>{v}</option> })}
          </select>

          <select value={item.quantity} onChange={function (e) { onChange({ quantity: Number(e.target.value) }) }} style={inputStyle}>
            {Array.from({ length: 10 }, function (_, i) { return i + 1 }).map(function (n) {
              return <option key={n} value={n}>Qty: {n}</option>
            })}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
          <label style={{ color: "#ffffff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="radio" checked={!item.isGraded} onChange={function () { onChange({ isGraded: false }) }} /> Ungraded
          </label>
          <label style={{ color: "#ffffff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="radio" checked={item.isGraded} onChange={function () { onChange({ isGraded: true }) }} /> Graded
          </label>
        </div>

        {item.isGraded ? (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <select value={item.gradingCompany} onChange={function (e) { onChange({ gradingCompany: e.target.value }) }} style={inputStyle}>
              <option value="PSA">PSA</option>
              <option value="BGS">BGS</option>
              <option value="CGC">CGC</option>
              <option value="Other">Other</option>
            </select>
            <select value={item.gradeNumber} onChange={function (e) { onChange({ gradeNumber: e.target.value }) }} style={inputStyle}>
              {GRADE_OPTIONS.map(function (g) { return <option key={g} value={g}>{g}</option> })}
            </select>
          </div>
        ) : (
          <select value={item.condition} onChange={function (e) { onChange({ condition: e.target.value }) }} style={{ ...inputStyle, marginTop: 6 }}>
            <option value="NM">Near Mint</option>
            <option value="LP">Lightly Played</option>
            <option value="MP">Moderately Played</option>
            <option value="HP">Heavily Played</option>
            <option value="DMG">Damaged</option>
          </select>
        )}
      </div>
    </div>
  )
}

export default function ImportQuote(props) {
  const onImported = props.onImported
  const router = useRouter()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState("scan")
  const [error, setError] = useState("")
  const [quoteId, setQuoteId] = useState(null)
  const [items, setItems] = useState([])
  const [collectionName, setCollectionName] = useState("")
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (phase !== "scan") return

    let stream = null
    let animationId = null
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch (err) {
        setError("Could not access camera: " + err.message)
      }
    }

    function tick() {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code && code.data) {
          try {
            const url = new URL(code.data)
            const match = url.pathname.match(/\/quote\/([a-z0-9]+)/)
            if (match) {
              stopped = true
              if (stream) stream.getTracks().forEach(function (t) { t.stop() })
              handleFound(match[1])
              return
            }
          } catch {}
        }
      }
      animationId = requestAnimationFrame(tick)
    }

    start()

    return function () {
      stopped = true
      if (stream) stream.getTracks().forEach(function (t) { t.stop() })
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [phase])

  async function handleFound(id) {
    setQuoteId(id)
    const rawItems = await getQuoteItems(id)
    const editable = rawItems.map(function (item) {
      return {
        itemId: item.id,
        cardId: item.cards?.id,
        cards: item.cards,
        variant: item.variant,
        condition: item.condition,
        isGraded: item.is_graded,
        gradingCompany: item.grade_value ? item.grade_value.split(" ")[0] : "PSA",
        gradeNumber: item.grade_value ? item.grade_value.split(" ")[1] || "10.0" : "10.0",
        quantity: item.quantity,
      }
    })
    setItems(editable)
    setCollectionName("Quote " + new Date().toLocaleDateString() + " #" + id.slice(-4).toUpperCase())
    setPhase("review")
  }

  function updateItem(index, changes) {
    setItems(function (prev) {
      const next = prev.slice()
      next[index] = Object.assign({}, next[index], changes)
      return next
    })
  }

  async function handleImport() {
    setImporting(true)
    const payload = items.map(function (item) {
      return {
        cardId: item.cardId,
        variant: item.variant,
        condition: item.condition,
        isGraded: item.isGraded,
        gradeValue: item.isGraded ? item.gradingCompany + " " + item.gradeNumber : null,
        quantity: item.quantity,
      }
    })
    await importQuoteAsCollection(quoteId, collectionName, payload)
    setImporting(false)
    router.refresh()
    setPhase("done")
    if (onImported) onImported()
  }

  if (phase === "scan") {
    return (
      <div style={{ maxWidth: 500 }}>
        <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Scan Quote QR Code</h2>
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>Point your camera at the customer's QR code.</p>
        {error ? (
          <p style={{ color: "#f87171" }}>{error}</p>
        ) : (
          <div>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 10, border: "2px solid #F2B705" }} muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}
      </div>
    )
  }

  if (phase === "review") {
    return (
      <div style={{ maxWidth: 700 }}>
        <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          Review Quote ({items.length} items)
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 4 }}>New collection name:</label>
          <input
            value={collectionName}
            onChange={function (e) { setCollectionName(e.target.value) }}
            style={{ ...inputStyle, width: "100%", fontSize: 16 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {items.map(function (item, i) {
            return (
              <EditableItem
                key={item.itemId}
                item={item}
                onChange={function (changes) { updateItem(i, changes) }}
              />
            )
          })}
        </div>

        <button
          onClick={handleImport}
          disabled={importing || items.length === 0}
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000",
            fontWeight: 700,
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 15,
            border: "none",
            cursor: importing ? "default" : "pointer",
          }}
        >
          {importing ? "Importing..." : "Import Quote Collection to My Collections"}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <p style={{ color: "#4ade80", fontSize: 16 }}>
        Imported as its own collection - find it in the collection picker.
      </p>
    </div>
  )
}