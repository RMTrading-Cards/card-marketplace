"use client"
import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { searchCards, addCardToCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
}

const EBAY_FVF_RATE = 0.1325
const EBAY_PER_ORDER_FEE = 0.40

function ebayPayout(value) {
  if (value == null) return null
  return Math.max(0, value * (1 - EBAY_FVF_RATE) - EBAY_PER_ORDER_FEE)
}

function getConditionPrice(card, variant, condition) {
  const basePrice = variant.price
  if (!card?.raw_skus) return basePrice
  const wantLang = card.region === "JP" ? "JP" : "EN"
  const rows = Object.values(card.raw_skus)
  const matches = rows.filter((r) => r.var === variant.key && r.cnd === condition)
  const best = matches.find((r) => r.lng === wantLang) || matches[0]
  if (best?.mkt != null) return best.mkt
  return basePrice
}

function getVariants(card) {
  const variants = []
  if (card.price_normal != null) variants.push({ key: "Normal", price: card.price_normal })
  if (card.price_holofoil != null) variants.push({ key: "Holofoil", price: card.price_holofoil })
  if (card.price_reverse_holofoil != null) variants.push({ key: "Reverse Holofoil", price: card.price_reverse_holofoil })
  if (card.price_1st_edition_holofoil != null) variants.push({ key: "1st Edition Holofoil", price: card.price_1st_edition_holofoil })
  if (variants.length === 0) {
    variants.push({ key: "Standard", price: card.tcgplayer_market_price })
  }
  return variants
}

const cardBox = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
}
const imageCol = { flex: "1 1 40%", maxWidth: 200, minWidth: 110 }
const infoCol = { flex: "1 1 50%", minWidth: 150 }
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
const controlStyle = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 16,
}

function CardResult({ card, variant, onAdded, collectionId }) {
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState("NM")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

  const market = getConditionPrice(card, variant, condition)
  const payout = ebayPayout(market)

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
      <div style={imageCol}>
        {card.image_small && (
          <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />
        )}
      </div>
      <div style={infoCol}>
        <p style={{ color: "#ffffff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          {card.region === "JP" ? "JP " : ""}{card.name}
          {card.card_number && card.set_total && (
            <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
          )}
        </p>
        <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>
          {card.set_name}
          {card.release_year && ` · ${card.release_year}`}
        </p>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {card.rarity && (
            <span style={{ color: "#F2B705", fontSize: 12 }}>{card.rarity}</span>
          )}
          <span style={{ color: "#9ca3af", fontSize: 12 }}>· {variant.key}</span>
        </div>
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
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>
              eBay Payout (~87%): {formatPrice(payout)}
            </div>
          </div>
        )}

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
          <input type="hidden" name="variant" value={variant.key} />
          <input type="hidden" name="collection_id" value={collectionId || ""} />
          <select
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={inputStyle}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Qty: {n}</option>
            ))}
          </select>
          <select
            name="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
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
    </div>
  )
}

export default function AddCardsSearch({ onAdded, collectionId }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [sortBy, setSortBy] = useState("name")
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const debounceRef = useRef(null)

  function runSearch(value, sort, pg, size) {
    startTransition(async () => {
      const response = await searchCards(value, sort, pg, size)
      setResults(response?.results || [])
      setTotalCount(response?.totalCount || 0)
    })
  }

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(value, sortBy, 1, pageSize)
    }, 300)
  }

  function handleSortChange(newSort) {
    setSortBy(newSort)
    setPage(1)
    if (query.length >= 2) runSearch(query, newSort, 1, pageSize)
  }

  function handlePageSizeChange(newSize) {
    setPageSize(newSize)
    setPage(1)
    if (query.length >= 2) runSearch(query, sortBy, 1, newSize)
  }

  function goToPage(newPage) {
    setPage(newPage)
    runSearch(query, sortBy, newPage, pageSize)
  }

  function handleAdded() {
    setQuery("")
    setResults([])
    setTotalCount(0)
    setPage(1)
    onAdded()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 700, marginBottom: 16, flexWrap: "wrap" }}>
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
        <select value={sortBy} onChange={(e) => handleSortChange(e.target.value)} style={controlStyle}>
          <option value="name">Name A → Z</option>
          <option value="price_desc">Price High → Low</option>
          <option value="price_asc">Price Low → High</option>
        </select>
        <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} style={controlStyle}>
          <option value={20}>Show 20</option>
          <option value={50}>Show 50</option>
          <option value={100}>Show 100</option>
        </select>
      </div>

      {isPending && <p style={{ color: "#ffffff", marginBottom: 16 }}>Searching...</p>}

      {!isPending && query.length >= 2 && (
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>
          {totalCount} result{totalCount === 1 ? "" : "s"} found
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          marginBottom: 16,
        }}
      >
        {results.map((card) =>
          getVariants(card).map((variant) => (
            <CardResult
              key={`${card.id}-${variant.key}`}
              card={card}
              variant={variant}
              onAdded={handleAdded}
              collectionId={collectionId}
            />
          ))
        )}
      </div>

      {totalCount > pageSize && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rmt-tab"
            style={{ ...controlStyle, padding: "8px 14px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}
          >
            ← Prev
          </button>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rmt-tab"
            style={{ ...controlStyle, padding: "8px 14px", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}