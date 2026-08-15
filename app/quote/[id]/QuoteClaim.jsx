"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getQuoteItems, claimQuoteSession, listCollections } from "../../collection/actions"

function formatPrice(n) {
  return n == null ? "N/A" : "$" + n.toFixed(2)
}

function getVariantPrice(card, variant) {
  if (!card) return null
  switch (variant) {
    case "Normal": return card.price_normal
    case "Holofoil": return card.price_holofoil
    case "Reverse Holofoil": return card.price_reverse_holofoil
    case "1st Edition Holofoil": return card.price_1st_edition_holofoil
    default: return card.tcgplayer_market_price
  }
}

export default function QuoteClaim({ quoteId, alreadyClaimed }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [targetCollectionId, setTargetCollectionId] = useState("")
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(alreadyClaimed)

  useEffect(() => {
    getQuoteItems(quoteId).then(setItems)
    listCollections().then(function (cols) {
      setCollections(cols)
      const main = cols.find(function (c) { return c.is_main })
      if (main) setTargetCollectionId(main.id)
    })
  }, [quoteId])

  const total = items.reduce(function (sum, item) {
    const market = getVariantPrice(item.cards, item.variant)
    return sum + (market || 0) * item.quantity
  }, 0)

  async function handleImport() {
    setImporting(true)
    await claimQuoteSession(quoteId, targetCollectionId)
    setImporting(false)
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 16 }}>
        <p style={{ color: "#4ade80", fontSize: 16 }}>
          This quote has been imported into your collection.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Quote Review
      </h1>
      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
        {items.length} item(s) scanned - estimated market total: <strong style={{ color: "#F2B705" }}>{formatPrice(total)}</strong>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {items.map(function (item) {
          const market = getVariantPrice(item.cards, item.variant)
          return (
            <div key={item.id} style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, display: "flex", gap: 12 }}>
              {item.cards?.image_small && (
                <img src={item.cards.image_small} alt={item.cards.name} style={{ width: 60, borderRadius: 4 }} />
              )}
              <div style={{ color: "#ffffff", fontSize: 13, flex: 1 }}>
                <strong>{item.cards?.name}</strong> ({item.cards?.set_name})
                <div style={{ color: "#9ca3af" }}>
                  Qty {item.quantity} - {item.is_graded ? item.grade_value : item.condition} - {item.variant}
                </div>
                <div style={{ color: "#F2B705", fontWeight: 700 }}>Market: {formatPrice(market)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 6 }}>Import into collection:</label>
        <select
          value={targetCollectionId}
          onChange={function (e) { setTargetCollectionId(e.target.value) }}
          style={{ backgroundColor: "#0d0d0d", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "8px 10px", fontSize: 16, width: "100%" }}
        >
          {collections.map(function (c) {
            return <option key={c.id} value={c.id}>{c.name}{c.is_main ? " (Main)" : ""}</option>
          })}
        </select>
      </div>

      <button
        onClick={handleImport}
        disabled={importing || items.length === 0}
        style={{ width: "100%", backgroundColor: "#F2B705", color: "#000", fontWeight: 700, borderRadius: 8, padding: "12px 20px", fontSize: 15, border: "none", cursor: importing ? "default" : "pointer" }}
      >
        {importing ? "Importing..." : "Import All Into Collection"}
      </button>
    </div>
  )
}