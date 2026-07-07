"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { searchSealedProducts, addSealedToCollection } from "./actions"

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

function SealedResult({ product, onAdded, collectionId }) {
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const diff = parsedPrice != null ? product.unopenedPrice - parsedPrice : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    await addSealedToCollection(formData)
    setSubmitting(false)
    router.refresh()
    onAdded()
  }

  return (
    <div style={cardBox}>
      {product.imageUrl && (
        <img src={product.imageUrl} alt={product.name} style={{ width: "100%", borderRadius: 6, marginBottom: 8 }} />
      )}
      <p style={{ color: "#ffffff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{product.name}</p>
      <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>{product.setName}</p>
      <p style={{ color: "#ffffff", fontSize: 14, marginBottom: 8 }}>
        Market: {formatPrice(product.unopenedPrice)}
      </p>
      {diff != null && (
        <p style={{ color: diff >= 0 ? "#4ade80" : "#f87171", fontSize: 12, marginBottom: 8 }}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)} at market
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="hidden" name="product_id" value={product.id} />
        <input type="hidden" name="collection_id" value={collectionId || ""} />
        <input type="hidden" name="tcgplayer_id" value={product.tcgPlayerId} />
        <input type="hidden" name="name" value={product.name} />
        <input type="hidden" name="set_name" value={product.setName} />
        <input type="hidden" name="image_url" value={product.imageUrl} />
        <input type="hidden" name="market_price" value={product.unopenedPrice} />
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

export default function AddSealedSearch({ onAdded, collectionId }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function runSearch() {
    startTransition(async () => {
      const data = await searchSealedProducts(query)
      setResults(data || [])
    })
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") runSearch()
  }

  function handleAdded() {
    setQuery("")
    setResults([])
    onAdded()
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 576, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search booster boxes, ETBs, etc. — press Enter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={runSearch}
          className="rmt-btn"
          style={{
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: 8,
            padding: "0 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>
      {isPending && <p style={{ color: "#ffffff", marginBottom: 16 }}>Searching...</p>}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {results.map((product) => (
          <SealedResult key={product.id} product={product} onAdded={handleAdded} collectionId={collectionId} />
        ))}
      </div>
    </div>
  )
}
