"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import AddCardsSearch from "./AddCardsSearch"
import AddSealedSearch from "./AddSealedSearch"
import CollectionSelector from "./CollectionSelector"
import {
  removeCardFromCollection,
  removeSealedFromCollection,
  setManualPrice,
  updateItemQuantity,
  updateItemPurchasePrice,
} from "./actions"

function formatPrice(n) {
  return n == null ? "—" : `$${n.toFixed(2)}`
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
  const [submitting, setSubmitting] = useState(false)

  async function handleChange(e) {
    setSubmitting(true)
    const formData = new FormData()
    formData.set("id", id)
    formData.set("item_type", itemType)
    formData.set("quantity", e.target.value)
    await updateItemQuantity(formData)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <select
      defaultValue={quantity}
      onChange={handleChange}
      disabled={submitting}
      style={{
        backgroundColor: "#0d0d0d",
        border: "1px solid #2a2a2a",
        color: "#ffffff",
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 14,
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
            width: 80,
            backgroundColor: "#0d0d0d",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 6,
            padding: "2px 6px",
            fontSize: 14,
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
      style={{ textDecoration: "underline dotted", cursor: "pointer" }}
      title="Click to edit"
    >
      Paid: {formatPrice(purchasePrice)}
    </span>
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
  const [tab, setTab] = useState("collection")
  const [selectedCollectionId, setSelectedCollectionId] = useState(mainCollectionId)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId)

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
    }))
    return [...cardRows, ...sealedRows]
  }, [myCards, mySealed])

  const inSelectedCollection = useMemo(
    () => combined.filter((row) => row.collectionId === selectedCollectionId),
    [combined, selectedCollectionId]
  )

  const totals = useMemo(() => {
    let paid = 0
    let market = 0
    for (const row of inSelectedCollection) {
      const effectiveMarket = row.market ?? row.manualPrice
      if (row.purchasePrice != null) paid += row.purchasePrice * row.quantity
      if (effectiveMarket != null) market += effectiveMarket * row.quantity
    }
    return { paid, market, profit: market - paid }
  }, [inSelectedCollection])

  const filtered = useMemo(() => {
    let list = inSelectedCollection.filter((row) =>
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
      return 0
    })
    return list
  }, [inSelectedCollection, query, typeFilter, sortBy])

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

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button className={`rmt-tab${tab === "collection" ? " rmt-tab-active" : ""}`} onClick={() => setTab("collection")} style={tabButtonBase}>
          Collection
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
              <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Profit / Loss</div>
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
              <option value="name">Name A → Z</option>
              <option value="price_desc">Price High → Low</option>
              <option value="price_asc">Price Low → High</option>
            </select>
          </div>

          <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            {selectedCollection?.name || "Collection"} ({filtered.length})
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

                      <form action={removeCardFromCollection} style={{ marginTop: 10 }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="rmt-remove-btn" style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}>
                          Remove
                        </button>
                      </form>
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
                    <form action={removeSealedFromCollection} style={{ marginTop: 10 }}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="rmt-remove-btn" style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}>
                        Remove
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
