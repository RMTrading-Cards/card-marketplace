"use client"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import AddCardsSearch from "./AddCardsSearch"
import AddSealedSearch from "./AddSealedSearch"
import CollectionSelector from "./CollectionSelector"
import {
  removeCardFromCollection,
  removeSealedFromCollection,
  setManualPrice,
  updateItemQuantity,
  updateItemPurchasePrice,
  sellCardItem,
  sellSealedItem,
  clearSoldHistory,
  removeSoldItem,
} from "./actions"

function formatPrice(n) {
  return n == null ? "—" : `$${n.toFixed(2)}`
}

function daysBetween(startAt, endAt) {
  if (!startAt) return null
  const start = new Date(startAt).getTime()
  const end = endAt ? new Date(endAt).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / 86400000))
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

function ThresholdRow({ label, value, purchasePrice }) {
  if (value == null) return null
  const diff = purchasePrice != null ? value - purchasePrice : null

  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "#d1d5db" }}>{label}: {formatPrice(value)}</span>
      {diff != null && (
        <span style={{ color: diff >= 0 ? "#4ade80" : "#f87171", marginLeft: 8 }}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)}
        </span>
      )}
    </div>
  )
}

function ManualPriceInput({ id, itemType, currentValue }) {
  const [value, setValue] = useState(currentValue ?? "")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData()
    formData.set("id", id)
    formData.set("item_type", itemType)
    formData.set("manual_price", value)
    await setManualPrice(formData)
    setSubmitting(false)
    window.location.reload()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", maxWidth: "100%" }}>
      <input
        type="number"
        step="0.01"
        placeholder="Set your own market value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          backgroundColor: "#0d0d0d",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 16,
          width: "100%",
          maxWidth: 200,
          boxSizing: "border-box",
        }}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rmt-btn"
        style={{
          backgroundColor: "#F2B705",
          color: "#000",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 13,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        Save
      </button>
    </form>
  )
}

function QuantityEditor({ id, itemType, quantity }) {
  const router = useRouter()
  const [value, setValue] = useState(quantity)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setValue(quantity)
  }, [quantity])

  async function handleChange(e) {
    const newQty = Number(e.target.value)
    setValue(newQty)
    setSubmitting(true)
    const formData = new FormData()
    formData.set("id", id)
    formData.set("item_type", itemType)
    formData.set("quantity", newQty)
    await updateItemQuantity(formData)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={submitting}
      style={{
        backgroundColor: "#0d0d0d",
        border: "1px solid #2a2a2a",
        color: "#ffffff",
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 16,
      }}
    >
      {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>Qty: {n}</option>
      ))}
    </select>
  )
}

function EditablePaid({ id, itemType, purchasePrice }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(purchasePrice ?? "")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData()
    formData.set("id", id)
    formData.set("item_type", itemType)
    formData.set("purchase_price", value)
    await updateItemPurchasePrice(formData)
    setSubmitting(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: 90,
            backgroundColor: "#0d0d0d",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rmt-btn"
          style={{ backgroundColor: "#F2B705", color: "#000", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 13, cursor: "pointer" }}
        >
          Save
        </button>
      </form>
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{ textDecoration: "underline dotted", cursor: "pointer", fontWeight: 700 }}
      title="Click to edit"
    >
      Paid: {formatPrice(purchasePrice)}
    </span>
  )
}

function SellForm({ id, itemType, availableQuantity }) {
  const router = useRouter()
  const [price, setPrice] = useState("")
  const [qty, setQty] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData()
    formData.set("id", id)
    formData.set("sold_price", price)
    formData.set("sold_quantity", qty)
    if (itemType === "sealed") await sellSealedItem(formData)
    else await sellCardItem(formData)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        style={{
          backgroundColor: "#0d0d0d",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          borderRadius: 6,
          padding: "2px 6px",
          fontSize: 16,
        }}
      >
        {Array.from({ length: availableQuantity }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>Sell: {n}</option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        placeholder="Sold for $ (each)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
        style={{
          backgroundColor: "#0d0d0d",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          borderRadius: 6,
          padding: "6px 8px",
          fontSize: 16,
          width: 130,
          boxSizing: "border-box",
        }}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rmt-btn"
        style={{
          backgroundColor: "#F2B705",
          color: "#000000",
          fontWeight: 600,
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 14,
          border: "none",
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Saving..." : "Mark Sold"}
      </button>
    </form>
  )
}

function ActualProfitBox({ label, value, onClear }) {
  return (
    <div style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 20px", minWidth: 240 }}>
      <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: value >= 0 ? "#4ade80" : "#f87171", fontSize: 20, fontWeight: 700 }}>
          {value >= 0 ? "+" : ""}{formatPrice(value)}
        </div>
        <button
          onClick={onClear}
          className="rmt-remove-btn"
          style={{ backgroundColor: "#2a1414", border: "1px solid #3a1a1a", color: "#f87171", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Clear
        </button>
      </div>
    </div>
  )
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
const imageCol = {
  flex: "1 1 40%",
  maxWidth: 200,
  minWidth: 110,
}
const infoCol = {
  flex: "1 1 50%",
  minWidth: 150,
  color: "#ffffff",
}

const tabButtonBase = {
  padding: "8px 20px",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #2a2a2a",
  backgroundColor: "#141414",
  color: "#ffffff",
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

const statBox = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: "14px 20px",
  minWidth: 160,
}

export default function CollectionTabs({ myCards, mySealed, collections, mainCollectionId }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = searchParams.get("tab") || "collection"
  const sellingMode = searchParams.get("selling") === "1"
  const query = searchParams.get("q") || ""
  const typeFilter = searchParams.get("type") || "all"
  const sortBy = searchParams.get("sort") || "date_desc"

  const [selectedCollectionId, setSelectedCollectionId] = useState(mainCollectionId)

  const [soldQuery, setSoldQuery] = useState("")
  const [soldTypeFilter, setSoldTypeFilter] = useState("all")
  const [soldSortBy, setSoldSortBy] = useState("date_desc")

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId)

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams.toString())
    if (value == null || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function setTab(newTab) {
    updateParam("tab", newTab === "collection" ? null : newTab)
  }

  function setQuery(newQuery) {
    updateParam("q", newQuery)
  }

  function setTypeFilter(newType) {
    updateParam("type", newType === "all" ? null : newType)
  }

  function setSortBy(newSort) {
    updateParam("sort", newSort === "date_desc" ? null : newSort)
  }

  function toggleSellingMode() {
    updateParam("selling", sellingMode ? null : "1")
  }

  const combined = useMemo(() => {
    const cardRows = (myCards || []).map((item) => ({
      kind: "card",
      id: item.id,
      name: item.cards?.name || "",
      subLabel: item.cards?.set_name,
      image: item.cards?.image_small,
      market: getVariantPrice(item.cards, item.variant),
      manualPrice: item.manual_price,
      quantity: item.quantity,
      purchasePrice: item.purchase_price,
      condition: item.condition,
      variant: item.variant,
      collectionId: item.collection_id,
      createdAt: item.created_at,
      soldPrice: item.sold_price,
      soldAt: item.sold_at,
      cardMeta: item.cards,
    }))
    const sealedRows = (mySealed || []).map((item) => ({
      kind: "sealed",
      id: item.id,
      name: item.name,
      subLabel: item.set_name,
      image: item.image_url,
      market: item.market_price,
      manualPrice: item.manual_price,
      quantity: item.quantity,
      purchasePrice: item.purchase_price,
      collectionId: item.collection_id,
      createdAt: item.created_at,
      soldPrice: item.sold_price,
      soldAt: item.sold_at,
    }))
    return [...cardRows, ...sealedRows]
  }, [myCards, mySealed])

  const activeInCollection = useMemo(
    () => combined.filter((row) => row.collectionId === selectedCollectionId && row.soldAt == null),
    [combined, selectedCollectionId]
  )

  const soldInCollection = useMemo(
    () =>
      combined
        .filter((row) => row.collectionId === selectedCollectionId && row.soldAt != null)
        .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()),
    [combined, selectedCollectionId]
  )

  const soldAverages = useMemo(() => {
    const groups = {}
    for (const row of soldInCollection) {
      if (row.soldPrice == null) continue
      const key =
        row.kind === "card"
          ? `card-${row.cardMeta?.id}-${row.variant || "Standard"}`
          : `sealed-${row.name}`
      if (!groups[key]) groups[key] = { totalRevenue: 0, totalQty: 0, count: 0 }
      groups[key].totalRevenue += row.soldPrice * row.quantity
      groups[key].totalQty += row.quantity
      groups[key].count += 1
    }
    const averages = {}
    for (const key in groups) {
      const g = groups[key]
      averages[key] = { avg: g.totalRevenue / g.totalQty, count: g.count }
    }
    return averages
  }, [soldInCollection])

  const filteredSold = useMemo(() => {
    let list = soldInCollection.filter((row) =>
      row.name.toLowerCase().includes(soldQuery.toLowerCase())
    )
    if (soldTypeFilter !== "all") {
      list = list.filter((row) => row.kind === soldTypeFilter)
    }
    list.sort((a, b) => {
      if (soldSortBy === "name") return a.name.localeCompare(b.name)
      if (soldSortBy === "price_desc") return (b.soldPrice ?? -1) - (a.soldPrice ?? -1)
      if (soldSortBy === "price_asc") return (a.soldPrice ?? Infinity) - (b.soldPrice ?? Infinity)
      if (soldSortBy === "date_desc") return new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()
      if (soldSortBy === "date_asc") return new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime()
      return 0
    })
    return list
  }, [soldInCollection, soldQuery, soldTypeFilter, soldSortBy])

  const totals = useMemo(() => {
    let paid = 0
    let market = 0
    for (const row of activeInCollection) {
      const effectiveMarket = row.market ?? row.manualPrice
      if (row.purchasePrice != null) paid += row.purchasePrice * row.quantity
      if (effectiveMarket != null) market += effectiveMarket * row.quantity
    }
    return { paid, market, profit: market - paid }
  }, [activeInCollection])

  const actualProfit = useMemo(() => {
    let total = 0
    for (const row of soldInCollection) {
      if (row.soldPrice != null && row.purchasePrice != null) {
        total += (row.soldPrice - row.purchasePrice) * row.quantity
      }
    }
    return total
  }, [soldInCollection])

  const filtered = useMemo(() => {
    let list = activeInCollection.filter((row) =>
      row.name.toLowerCase().includes(query.toLowerCase())
    )
    if (typeFilter !== "all") {
      list = list.filter((row) => row.kind === typeFilter)
    }
    list.sort((a, b) => {
      const effA = a.market ?? a.manualPrice ?? -1
      const effB = b.market ?? b.manualPrice ?? -1
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "price_desc") return effB - effA
      if (sortBy === "price_asc") return (a.market ?? a.manualPrice ?? Infinity) - (b.market ?? b.manualPrice ?? Infinity)
      if (sortBy === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return 0
    })
    return list
  }, [activeInCollection, query, typeFilter, sortBy])

  async function handleClearSold() {
    if (!confirm("Clear sold history and reset actual profit for this collection? This can't be undone.")) return
    const formData = new FormData()
    formData.set("collection_id", selectedCollectionId)
    await clearSoldHistory(formData)
    router.refresh()
  }

  return (
    <div>
      <style>{`
        .rmt-tab { transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease; }
        .rmt-tab:hover { background-color: #1f1f1f; border-color: #3a3a3a; }
        .rmt-tab:active { transform: scale(0.96); }
        .rmt-tab-active, .rmt-tab-active:hover { background-color: #F2B705 !important; color: #000000 !important; border-color: #F2B705 !important; }
        .rmt-btn { transition: filter 0.15s ease, transform 0.08s ease; }
        .rmt-btn:hover { filter: brightness(1.12); }
        .rmt-btn:active { transform: scale(0.96); }
        .rmt-remove-btn { transition: background-color 0.15s ease, transform 0.08s ease; }
        .rmt-remove-btn:hover { background-color: #3a1a1a; }
        .rmt-remove-btn:active { transform: scale(0.96); }
      `}</style>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <button className={`rmt-tab${tab === "collection" ? " rmt-tab-active" : ""}`} onClick={() => setTab("collection")} style={tabButtonBase}>
          Collection
        </button>
        <button className={`rmt-tab${tab === "sold" ? " rmt-tab-active" : ""}`} onClick={() => setTab("sold")} style={tabButtonBase}>
          Sold History
        </button>
        <button className={`rmt-tab${tab === "cards" ? " rmt-tab-active" : ""}`} onClick={() => setTab("cards")} style={tabButtonBase}>
          Add Cards
        </button>
        <button className={`rmt-tab${tab === "sealed" ? " rmt-tab-active" : ""}`} onClick={() => setTab("sealed")} style={tabButtonBase}>
          Add Sealed
        </button>
      </div>

      {tab === "collection" && (
        <div>
          <CollectionSelector
            collections={collections}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            sellingMode={sellingMode}
            onToggleSelling={toggleSellingMode}
          />

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={statBox}>
              <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Total Paid</div>
              <div style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>{formatPrice(totals.paid)}</div>
            </div>
            <div style={statBox}>
              <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Market Value</div>
              <div style={{ color: "#F2B705", fontSize: 20, fontWeight: 700 }}>{formatPrice(totals.market)}</div>
            </div>
            <div style={statBox}>
              <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Unrealized Profit / Loss</div>
              <div style={{ color: totals.profit >= 0 ? "#4ade80" : "#f87171", fontSize: 20, fontWeight: 700 }}>
                {totals.profit >= 0 ? "+" : ""}{formatPrice(totals.profit)}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Search this collection..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...controlStyle, flex: 1, minWidth: 200 }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={controlStyle}>
              <option value="all">All Items</option>
              <option value="card">Cards Only</option>
              <option value="sealed">Sealed Only</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={controlStyle}>
              <option value="date_desc">Newest Added</option>
              <option value="date_asc">Oldest Added</option>
              <option value="name">Name A → Z</option>
              <option value="price_desc">Price High → Low</option>
              <option value="price_asc">Price Low → High</option>
            </select>
          </div>

          <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            {selectedCollection?.name || "Collection"} ({filtered.length})
            {sellingMode && <span style={{ color: "#F2B705", fontSize: 14, marginLeft: 8 }}>· Selling Mode</span>}
          </h2>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {filtered.length === 0 && (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No items found.</p>
            )}

            {filtered.map((row) => {
              const held = daysBetween(row.createdAt, null)

              if (row.kind === "card") {
                const card = row.cardMeta
                const market = row.market
                const purchasePrice = row.purchasePrice

                return (
                  <div key={`card-${row.id}`} style={cardBox}>
                    <div style={imageCol}>
                      {row.image && (
                        <img src={row.image} alt={row.name} style={{ width: "100%", borderRadius: 6 }} />
                      )}
                      {held != null && (
                        <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4, textAlign: "center" }}>
                          Held for: {held} day(s)
                        </div>
                      )}
                    </div>
                    <div style={infoCol}>
                      <strong>
                        {card?.name}
                        {card?.card_number && card?.set_total && (
                          <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
                        )}
                      </strong>{" "}
                      <span style={{ color: "#9ca3af" }}>
                        ({card?.set_name}{card?.release_year && ` · ${card.release_year}`})
                      </span>
                      {card?.rarity && (
                        <div style={{ color: "#F2B705", fontSize: 12, marginTop: 2 }}>
                          {card.rarity} · {row.variant || "Standard"}
                        </div>
                      )}
                      <div style={{ fontSize: 13, marginTop: 6, marginBottom: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <QuantityEditor id={row.id} itemType="card" quantity={row.quantity} />
                        <span>· Condition: {row.condition} ·</span>
                        <EditablePaid id={row.id} itemType="card" purchasePrice={purchasePrice} />
                      </div>

                      {market != null ? (
                        <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
                          <ThresholdRow label="85%" value={market * 0.85} purchasePrice={purchasePrice} />
                          <ThresholdRow label="90%" value={market * 0.9} purchasePrice={purchasePrice} />
                          <ThresholdRow label="95%" value={market * 0.95} purchasePrice={purchasePrice} />
                          <ThresholdRow label="Market" value={market} purchasePrice={purchasePrice} />
                        </div>
                      ) : row.manualPrice != null ? (
                        <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Manually set value:</div>
                          <ThresholdRow label="85%" value={row.manualPrice * 0.85} purchasePrice={purchasePrice} />
                          <ThresholdRow label="90%" value={row.manualPrice * 0.9} purchasePrice={purchasePrice} />
                          <ThresholdRow label="95%" value={row.manualPrice * 0.95} purchasePrice={purchasePrice} />
                          <ThresholdRow label="Market (manual)" value={row.manualPrice} purchasePrice={purchasePrice} />
                          <ManualPriceInput id={row.id} itemType="card" currentValue={row.manualPrice} />
                        </div>
                      ) : (
                        <div>
                          <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>Market: N/A</div>
                          <ManualPriceInput id={row.id} itemType="card" currentValue={null} />
                        </div>
                      )}

                      {sellingMode ? (
                        <SellForm id={row.id} itemType="card" availableQuantity={row.quantity} />
                      ) : (
                        <form action={removeCardFromCollection} style={{ marginTop: 10 }}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="rmt-remove-btn" style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}>
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )
              }

              const effectiveMarket = row.market ?? row.manualPrice
              const diff =
                effectiveMarket != null && row.purchasePrice != null
                  ? effectiveMarket - row.purchasePrice
                  : null

              return (
                <div key={`sealed-${row.id}`} style={cardBox}>
                  <div style={imageCol}>
                    {row.image && (
                      <img src={row.image} alt={row.name} style={{ width: "100%", borderRadius: 6 }} />
                    )}
                    {held != null && (
                      <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4, textAlign: "center" }}>
                        Held for: {held} day(s)
                      </div>
                    )}
                  </div>
                  <div style={infoCol}>
                    <strong>{row.name}</strong>{" "}
                    <span style={{ color: "#9ca3af" }}>({row.subLabel})</span>
                    <div style={{ fontSize: 13, marginTop: 6, marginBottom: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <QuantityEditor id={row.id} itemType="sealed" quantity={row.quantity} />
                      <span>·</span>
                      <EditablePaid id={row.id} itemType="sealed" purchasePrice={row.purchasePrice} />
                      <span>· Market: {formatPrice(row.market)}</span>
                    </div>
                    {row.market == null && (
                      <ManualPriceInput id={row.id} itemType="sealed" currentValue={row.manualPrice} />
                    )}
                    {diff != null && (
                      <div style={{ color: diff >= 0 ? "#4ade80" : "#f87171" }}>
                        {diff >= 0 ? "+" : ""}
                        {diff.toFixed(2)}
                      </div>
                    )}
                    {sellingMode ? (
                      <SellForm id={row.id} itemType="sealed" availableQuantity={row.quantity} />
                    ) : (
                      <form action={removeSealedFromCollection} style={{ marginTop: 10 }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="rmt-remove-btn" style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}>
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === "sold" && (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={statBox}>
              <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Items Sold</div>
              <div style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>{soldInCollection.length}</div>
            </div>
            <ActualProfitBox label="Actual Profit / Loss" value={actualProfit} onClear={handleClearSold} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Search sold history..."
              value={soldQuery}
              onChange={(e) => setSoldQuery(e.target.value)}
              style={{ ...controlStyle, flex: 1, minWidth: 200 }}
            />
            <select value={soldTypeFilter} onChange={(e) => setSoldTypeFilter(e.target.value)} style={controlStyle}>
              <option value="all">All Items</option>
              <option value="card">Cards Only</option>
              <option value="sealed">Sealed Only</option>
            </select>
            <select value={soldSortBy} onChange={(e) => setSoldSortBy(e.target.value)} style={controlStyle}>
              <option value="date_desc">Newest Sold</option>
              <option value="date_asc">Oldest Sold</option>
              <option value="name">Name A → Z</option>
              <option value="price_desc">Sold Price High → Low</option>
              <option value="price_asc">Sold Price Low → High</option>
            </select>
          </div>

          <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Sold History — {selectedCollection?.name || "Collection"} ({filteredSold.length})
          </h2>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {filteredSold.length === 0 && (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No sold items found.</p>
            )}

            {filteredSold.map((row) => {
              const held = daysBetween(row.createdAt, row.soldAt)
              const profit =
                row.soldPrice != null && row.purchasePrice != null
                  ? (row.soldPrice - row.purchasePrice) * row.quantity
                  : null
              const name = row.kind === "card" ? row.cardMeta?.name : row.name
              const avgKey =
                row.kind === "card"
                  ? `card-${row.cardMeta?.id}-${row.variant || "Standard"}`
                  : `sealed-${row.name}`
              const avgInfo = soldAverages[avgKey]

              return (
                <div key={`sold-${row.kind}-${row.id}`} style={cardBox}>
                  <div style={imageCol}>
                    {row.image && (
                      <img src={row.image} alt={name} style={{ width: "100%", borderRadius: 6 }} />
                    )}
                    {held != null && (
                      <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4, textAlign: "center" }}>
                        Held for: {held} day(s)
                      </div>
                    )}
                  </div>
                  <div style={infoCol}>
                    <strong>{name}</strong>{" "}
                    <span style={{ color: "#9ca3af" }}>({row.subLabel})</span>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      Qty: {row.quantity} · Paid: {formatPrice(row.purchasePrice)} · Sold: {formatPrice(row.soldPrice)}
                    </div>
                    {profit != null && (
                      <div style={{ color: profit >= 0 ? "#4ade80" : "#f87171", fontWeight: 700, marginTop: 4 }}>
                        {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                      </div>
                    )}
                    <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                      Sold on {row.soldAt ? new Date(row.soldAt).toLocaleDateString() : "—"}
                    </div>
                    {avgInfo && avgInfo.count > 1 && (
                      <div style={{ color: "#F2B705", fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        Average Sold ({avgInfo.count}x): {formatPrice(avgInfo.avg)}
                      </div>
                    )}
                    <form action={removeSoldItem} style={{ marginTop: 10 }}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="item_type" value={row.kind} />
                      <button type="submit" className="rmt-remove-btn" style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}>
                        Remove from History
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === "cards" && (
        <AddCardsSearch collectionId={selectedCollectionId} onAdded={() => setTab("collection")} />
      )}
      {tab === "sealed" && (
        <AddSealedSearch collectionId={selectedCollectionId} onAdded={() => setTab("collection")} />
      )}
    </div>
  )
}
