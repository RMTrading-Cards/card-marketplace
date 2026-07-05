"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { searchSealedProducts, addSealedToCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
}

function SealedResult({ product, onAdded }) {
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const diff =
    parsedPrice != null ? (product.unopenedPrice - parsedPrice) * quantity : null

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
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-3">
      {product.imageUrl && (
        <img src={product.imageUrl} alt={product.name} className="w-full rounded mb-2" />
      )}
      <p className="text-white font-semibold text-sm mb-1">{product.name}</p>
      <p className="text-gray-400 text-xs mb-2">{product.setName}</p>
      <p className="text-white text-sm mb-2">
        Market: {formatPrice(product.unopenedPrice)}
      </p>
      {diff != null && (
        <p className={diff >= 0 ? "text-green-400 text-xs mb-2" : "text-red-400 text-xs mb-2"}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)} at market
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input type="hidden" name="product_id" value={product.id} />
        <input type="hidden" name="tcgplayer_id" value={product.tcgPlayerId} />
        <input type="hidden" name="name" value={product.name} />
        <input type="hidden" name="set_name" value={product.setName} />
        <input type="hidden" name="image_url" value={product.imageUrl} />
        <input type="hidden" name="market_price" value={product.unopenedPrice} />
        <input
          name="quantity"
          type="number"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded px-2 py-1 text-sm"
        />
        <input
          name="purchase_price"
          type="number"
          step="0.01"
          placeholder="Your purchase price"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded px-2 py-1 text-sm"
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
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "14px",
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

export default function AddSealedSearch({ onAdded }) {
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
      <div className="flex gap-2 max-w-xl mb-4">
        <input
          type="text"
          placeholder="Search booster boxes, ETBs, etc. — press Enter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-[#141414] border border-[#2a2a2a] text-white placeholder-gray-400
                     rounded-lg px-4 py-3 focus:outline-none focus:border-[#F2B705]"
        />
        <button
          onClick={runSearch}
          className="rmt-btn"
          style={{
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: "8px",
            padding: "0 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>
      {isPending && <p className="text-white mb-4">Searching...</p>}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {results.map((product) => (
          <SealedResult key={product.id} product={product} onAdded={handleAdded} />
        ))}
      </div>
    </div>
  )
}
