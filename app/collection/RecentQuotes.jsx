"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { listRecentQuotes, getQuoteItems, importQuoteAsCollection } from "./actions"
import { getVariantPrice, getConditionPriceRange } from "@/lib/pricing"

const inputStyle = {
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
  padding: "10px 14px",
  fontSize: 16,
  boxSizing: "border-box",
}

const statBox = { backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 20px", minWidth: 160 }

const GRADE_OPTIONS = []
for (let g = 10; g >= 1; g -= 0.5) GRADE_OPTIONS.push(g.toFixed(1))

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"]

const EBAY_FVF_RATE = 0.1325
const EBAY_PER_ORDER_FEE = 0.40

function formatPrice(n) {
  return n == null ? "N/A" : "$" + n.toFixed(2)
}

function ebayPayout(value) {
  if (value == null) return null
  return Math.max(0, value * (1 - EBAY_FVF_RATE) - EBAY_PER_ORDER_FEE)
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

function itemMarketValue(item) {
  if (item.isGraded) return getVariantPrice(item.cards, item.variant)
  return getConditionPriceRange(item.cards, item.variant, item.condition).market
}

function EditableItem(props) {
  const item = props.item
  const onChange = props.onChange
  const card = item.cards
  const variants = card ? getVariants(card) : ["Standard"]
  const priceRange = item.isGraded
    ? { low: null, market: getVariantPrice(card, item.variant), high: null }
    : getConditionPriceRange(card, item.variant, item.condition)
  const market = priceRange.market
  const payout = ebayPayout(market)

  const conditionPriceMap = {}
  for (const c of CONDITIONS) {
    conditionPriceMap[c] = getConditionPriceRange(card, item.variant, c).market
  }

  return (
    <div style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 30%", maxWidth: 150 }}>
        {card?.image_small && <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />}
      </div>
      <div style={{ flex: "1 1 60%", minWidth: 200, color: "#ffffff" }}>
        <strong>
          {card?.region === "JP" ? "JP " : ""}{card?.name}
          {card?.card_number && card?.set_total && (
            <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
          )}
        </strong>{" "}
        <span style={{ color: "#9ca3af" }}>({card?.set_name})</span>
        {card?.rarity && (
          <div style={{ color: "#F2B705", fontSize: 12, marginTop: 2 }}>{card.rarity}</div>
        )}

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
            {CONDITIONS.map(function (c) {
              return <option key={c} value={c}>{c + ": " + formatPrice(conditionPriceMap[c])}</option>
            })}
          </select>
        )}

        {market != null ? (
          <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
            {priceRange.low != null && (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Lowest Listing: {formatPrice(priceRange.low)}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#d1d5db" }}>
              <span>85%: {formatPrice(market * 0.85)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#d1d5db" }}>
              <span>90%: {formatPrice(market * 0.9)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#d1d5db" }}>
              <span>95%: {formatPrice(market * 0.95)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#d1d5db" }}>
              <span>eBay Payout (~87%): {formatPrice(payout)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              <span>Market ({item.isGraded ? "Graded" : item.condition}): {formatPrice(market)}</span>
            </div>
          </div>
        ) : (
          <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 10 }}>Market: N/A</div>
        )}
      </div>
    </div>
  )
}

export default function RecentQuotes() {
  const router = useRouter()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openQuoteId, setOpenQuoteId] = useState(null)
  const [items, setItems] = useState([])
  const [collectionName, setCollectionName] = useState("")
  const [importing, setImporting] = useState(false)
  const [importedIds, setImportedIds] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("price_desc")
  const [offerPercent, setOfferPercent] = useState(80)

  useEffect(() => { refreshQuotes() }, [])

  async function refreshQuotes() {
    setLoading(true)
    const data = await listRecentQuotes()
    setQuotes(data)
    setLoading(false)
  }

  async function handleOpen(quote) {
    const rawItems = await getQuoteItems(quote.id)
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
    setSearchQuery("")
    setSortBy("price_desc")
    setOfferPercent(80)
    setCollectionName("Quote " + new Date(quote.submitted_at || quote.created_at).toLocaleDateString() + " #" + quote.id.slice(-4).toUpperCase())
    setOpenQuoteId(quote.id)
  }

  function updateItem(itemId, changes) {
    setItems(function (prev) {
      return prev.map(function (it) {
        return it.itemId === itemId ? Object.assign({}, it, changes) : it
      })
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
    await importQuoteAsCollection(openQuoteId, collectionName, payload)
    setImporting(false)
    setImportedIds(function (prev) { return Object.assign({}, prev, { [openQuoteId]: true }) })
    setOpenQuoteId(null)
    router.refresh()
  }

  const totalMarketValue = items.reduce(function (sum, item) {
    const m = itemMarketValue(item)
    return sum + (m || 0) * item.quantity
  }, 0)

  const offerAmount = totalMarketValue * (offerPercent / 100)
  const unrealizedProfit = totalMarketValue - offerAmount

  const filteredSortedItems = items
    .filter(function (item) {
      if (!searchQuery.trim()) return true
      const name = (item.cards?.name || "").toLowerCase()
      return name.indexOf(searchQuery.toLowerCase()) !== -1
    })
    .slice()
    .sort(function (a, b) {
      if (sortBy === "name") return (a.cards?.name || "").localeCompare(b.cards?.name || "")
      const priceA = itemMarketValue(a) || 0
      const priceB = itemMarketValue(b) || 0
      if (sortBy === "price_asc") return priceA - priceB
      return priceB - priceA
    })

  if (openQuoteId) {
    return (
      <div style={{ maxWidth: 700 }}>
        <button
          onClick={function () { setOpenQuoteId(null) }}
          style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", marginBottom: 16 }}
        >
          Back to Quotes
        </button>

        <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          Review Quote ({items.length} items)
        </h2>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={statBox}>
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Total Market Value</div>
            <div style={{ color: "#F2B705", fontSize: 20, fontWeight: 700 }}>{formatPrice(totalMarketValue)}</div>
          </div>
          <div style={{ ...statBox, minWidth: 220 }}>
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>
              Offer at {offerPercent}% of Market
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={offerPercent}
              onChange={function (e) { setOfferPercent(Number(e.target.value)) }}
              style={{ width: "100%", marginBottom: 4 }}
            />
            <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 700 }}>{formatPrice(offerAmount)}</div>
          </div>
          <div style={statBox}>
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Unrealized Profit if Bought at {offerPercent}%</div>
            <div style={{ color: "#4ade80", fontSize: 20, fontWeight: 700 }}>+{formatPrice(unrealizedProfit)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 4 }}>New collection name:</label>
          <input value={collectionName} onChange={function (e) { setCollectionName(e.target.value) }} style={{ ...inputStyle, width: "100%", fontSize: 16 }} />
        </div>

        <button
          onClick={handleImport}
          disabled={importing || items.length === 0}
          style={{ width: "100%", backgroundColor: "#F2B705", color: "#000", fontWeight: 700, borderRadius: 8, padding: "12px 20px", fontSize: 15, border: "none", cursor: importing ? "default" : "pointer", marginBottom: 20 }}
        >
          {importing ? "Importing..." : "Import Quote Collection to My Collections"}
        </button>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Search cards in this quote..."
            value={searchQuery}
            onChange={function (e) { setSearchQuery(e.target.value) }}
            style={{ ...controlStyle, flex: 1, minWidth: 200 }}
          />
          <select value={sortBy} onChange={function (e) { setSortBy(e.target.value) }} style={controlStyle}>
            <option value="price_desc">Price High to Low</option>
            <option value="price_asc">Price Low to High</option>
            <option value="name">Name A to Z</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {filteredSortedItems.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No items match your search.</p>
          ) : (
            filteredSortedItems.map(function (item) {
              return (
                <EditableItem
                  key={item.itemId}
                  item={item}
                  onChange={function (changes) { updateItem(item.itemId, changes) }}
                />
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Recent Quotes
      </h2>

      {loading ? (
        <p style={{ color: "#9ca3af" }}>Loading...</p>
      ) : quotes.length === 0 ? (
        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No submitted quotes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quotes.map(function (quote) {
            const isImported = quote.claimed || importedIds[quote.id]
            return (
              <div key={quote.id} style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: "#ffffff", fontSize: 14 }}>
                  <div>{quote.itemCount} item(s)</div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>
                    Submitted {quote.submitted_at ? new Date(quote.submitted_at).toLocaleString() : "unknown"}
                  </div>
                </div>
                {isImported ? (
                  <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>Imported</span>
                ) : (
                  <button
                    onClick={function () { handleOpen(quote) }}
                    style={{ backgroundColor: "#F2B705", color: "#000", fontWeight: 600, borderRadius: 6, padding: "8px 16px", fontSize: 13, border: "none", cursor: "pointer" }}
                  >
                    Review & Import
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}