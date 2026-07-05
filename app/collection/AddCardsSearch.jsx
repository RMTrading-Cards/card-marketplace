"use client"
import { useState, useTransition } from "react"
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
  fontSize: 14,
  boxSizing: "border-box",
}

function CardResult({ card, onAdded }) {
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
          <span style={{ color: (market - parsedPrice) * quantity >= 0 ? "#4ade80" : "#f87171" }}>
            {(market - parsedPrice) * quantity >= 0 ? "+" : ""}
            {((market - parsedPrice) * quantity).toFixed(2)}
          </span>
        )}
      </p>

      {market != null && (
        <div style={{ marginBottom: 12 }}>
          {thresholds.map((pct) => {
            const value = market * pct
            const diff =
              parsedPrice != null ? (value - parsedPrice) * quantity : null
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
        <input
          name="quantity"
          type="number"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          style={inputStyle}
        />
        <select
          name="condition"
          defaultValue="NM"
          style={inputStyle}
        >
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

export default function AddCardsSearch({ onAdded }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    startTransition(async () => {
      const data = await searchCards(value)
      setResults(data || [])
    })
  }

  function handleAdded() {
    setQuery("")
    setResults([])
    onAdded()
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search cards..."
        value={query}
        onChange={handleChange}
        style={{
          width: "100%",
          maxWidth: 576,
          backgroundColor: "#141414",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 14,
          marginBottom: 16,
          boxSizing: "border-box",
        }}
      />
      {isPending && <p style={{ color: "#ffffff", marginBottom: 16 }}>Searching...</p>}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {results.map((card) => (
          <CardResult key={card.id} card={card} onAdded={handleAdded} />
        ))}
      </div>
    </div>
  )
}
