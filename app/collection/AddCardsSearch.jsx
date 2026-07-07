"use client"
import { useState, useTransition, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { searchCards, addCardToCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
}

const cardBox = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: 12,
}
const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 16,
  boxSizing: "border-box",
}

function CardResult({ card, onAdded, collectionId }) {
  const market = card.tcgplayer_market_price
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    await addCardToCollection(formData)
    setSubmitting(false)
    router.refresh()
    onAdded()
  }

  return (
    <div style={cardBox}>
      {card.image_small && (
        <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6, marginBottom: 8 }} />
      )}
      <p style={{ color: "#ffffff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {card.name}
        {card.card_number && card.set_total && (
          <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
        )}
      </p>
      <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>
        {card.set_name}
        {card.release_year && ` · ${card.release_year}`}
      </p>
      {card.rarity && (
        <p style={{ color: "#F2B705", fontSize: 12, marginBottom: 8 }}>{card.rarity}</p>
      )}
      <p style={{ color: "#ffffff", fontSize: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", maxWidth: 220 }}>
        <span>Market: {formatPrice(market)}</span>
        {market != null && parsedPrice != null && (
          <span style={{ color: market - parsedPrice >= 0 ? "#4ade80" : "#f87171" }}>
            {market - parsedPrice >= 0 ? "+" : ""}
            {(market - parsedPrice).toFixed(2)}
          </span>
        )}
      </p>

      {market != null && (
        <div style={{ marginBottom: 12 }}>
          {thresholds.map((pct) => {
            const value = market * pct
            const diff = parsedPrice != null ? value - parsedPrice : null
            return (
              <div key={pct} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#d1d5db", marginBottom: 2 }}>
                <span>{Math.round(pct * 100)}% = {formatPrice(value)}</span>
                {diff != null && (
                  <span style={{ color: diff >= 0 ? "#4ade80" : "#f87171", marginLeft: 8 }}>
                    {diff >= 0 ? "+" : ""}
                    {diff.toFixed(2)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="hidden" name="card_id" value={card.id} />
        <input type="hidden" name="collection_id" value={collectionId || ""} />
        <select
          name="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={inputStyle}
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Qty: {n}
            </option>
          ))}
        </select>
        <select name="condition" defaultValue="NM" style={inputStyle}>
          <option value="NM">Near Mint</option>
          <option value="LP">Lightly Played</option>
          <option value="MP">Moderately Played</option>
          <option value="HP">Heavily Played</option>
          <option value="DMG">Damaged</option>
        </select>
        <input
          name="purchase_price"
          type="number"
          step="0.01"
          placeholder="Your purchase price"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rmt-btn"
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 14,
            border: "none",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Adding..." : "Add to Collection"}
        </button>
      </form>
    </div>
  )
}

export default function AddCardsSearch({ onAdded, collectionId }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()
  const [sortBy, setSortBy] = useState("name")
  const debounceRef = useRef(null)

  function runSearch(value) {
    startTransition(async () => {
      const data = await searchCards(value)
      setResults(data || [])
    })
  }

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(value)
    }, 300)
  }

  function handleAdded() {
    setQuery("")
    setResults([])
    onAdded()
  }

  const sortedResults = useMemo(() => {
    const list = [...results]
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => (b.tcgplayer_market_price ?? -1) - (a.tcgplayer_market_price ?? -1))
    } else if (sortBy === "price_asc") {
      list.sort((a, b) => (a.tcgplayer_market_price ?? Infinity) - (b.tcgplayer_market_price ?? Infinity))
    }
    return list
  }, [results, sortBy])

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 576, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search cards..."
          value={query}
          onChange={handleChange}
          style={{
            flex: 1,
            minWidth: 200,
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "0 12px",
            fontSize: 16,
          }}
        >
          <option value="name">Name A → Z</option>
          <option value="price_desc">Price High → Low</option>
          <option value="price_asc">Price Low → High</option>
        </select>
      </div>
      {isPending && <p style={{ color: "#ffffff", marginBottom: 16 }}>Searching...</p>}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {sortedResults.map((card) => (
          <CardResult key={card.id} card={card} onAdded={handleAdded} collectionId={collectionId} />
        ))}
      </div>
    </div>
  )
}
