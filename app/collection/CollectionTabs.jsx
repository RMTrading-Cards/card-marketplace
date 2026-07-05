"use client"
import { useState, useMemo } from "react"
import AddCardsSearch from "./AddCardsSearch"
import AddSealedSearch from "./AddSealedSearch"
import { removeCardFromCollection, removeSealedFromCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "—" : `$${n.toFixed(2)}`
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

const rowBox = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: 12,
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

export default function CollectionTabs({ myCards, mySealed }) {
  const [tab, setTab] = useState("collection")
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")

  const combined = useMemo(() => {
    const cardRows = (myCards || []).map((item) => ({
      kind: "card",
      id: item.id,
      name: item.cards?.name || "",
      subLabel: item.cards?.set_name,
      image: item.cards?.image_small,
      market: item.cards?.tcgplayer_market_price,
      quantity: item.quantity,
      purchasePrice: item.purchase_price,
      condition: item.condition,
      cardMeta: item.cards,
    }))
    const sealedRows = (mySealed || []).map((item) => ({
      kind: "sealed",
      id: item.id,
      name: item.name,
      subLabel: item.set_name,
      image: item.image_url,
      market: item.market_price,
      quantity: item.quantity,
      purchasePrice: item.purchase_price,
    }))
    return [...cardRows, ...sealedRows]
  }, [myCards, mySealed])

  const filtered = useMemo(() => {
    let list = combined.filter((row) =>
      row.name.toLowerCase().includes(query.toLowerCase())
    )
    if (typeFilter !== "all") {
      list = list.filter((row) => row.kind === typeFilter)
    }
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "price_desc") return (b.market ?? -1) - (a.market ?? -1)
      if (sortBy === "price_asc") return (a.market ?? Infinity) - (b.market ?? Infinity)
      return 0
    })
    return list
  }, [combined, query, typeFilter, sortBy])

  const filteredCards = filtered.filter((r) => r.kind === "card")
  const filteredSealed = filtered.filter((r) => r.kind === "sealed")

  return (
    <div>
      <style>{`
        .rmt-tab {
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
        }
        .rmt-tab:hover {
          background-color: #1f1f1f;
          border-color: #3a3a3a;
        }
        .rmt-tab:active {
          transform: scale(0.96);
        }
        .rmt-tab-active, .rmt-tab-active:hover {
          background-color: #F2B705 !important;
          color: #000000 !important;
          border-color: #F2B705 !important;
        }
        .rmt-btn {
          transition: filter 0.15s ease, transform 0.08s ease;
        }
        .rmt-btn:hover {
          filter: brightness(1.12);
        }
        .rmt-btn:active {
          transform: scale(0.96);
        }
        .rmt-remove-btn {
          transition: background-color 0.15s ease, transform 0.08s ease;
        }
        .rmt-remove-btn:hover {
          background-color: #3a1a1a;
        }
        .rmt-remove-btn:active {
          transform: scale(0.96);
        }
      `}</style>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button
          className={`rmt-tab${tab === "collection" ? " rmt-tab-active" : ""}`}
          onClick={() => setTab("collection")}
          style={tabButtonBase}
        >
          Collection
        </button>
        <button
          className={`rmt-tab${tab === "cards" ? " rmt-tab-active" : ""}`}
          onClick={() => setTab("cards")}
          style={tabButtonBase}
        >
          Add Cards
        </button>
        <button
          className={`rmt-tab${tab === "sealed" ? " rmt-tab-active" : ""}`}
          onClick={() => setTab("sealed")}
          style={tabButtonBase}
        >
          Add Sealed
        </button>
      </div>

      {tab === "collection" && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Search your collection..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...controlStyle, flex: 1, minWidth: 200 }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={controlStyle}
            >
              <option value="all">All Items</option>
              <option value="card">Cards Only</option>
              <option value="sealed">Sealed Only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={controlStyle}
            >
              <option value="name">Name A → Z</option>
              <option value="price_desc">Price High → Low</option>
              <option value="price_asc">Price Low → High</option>
            </select>
          </div>

          {typeFilter !== "sealed" && (
            <>
              <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                Your Cards ({filteredCards.length})
              </h2>
              <div style={{ display: "grid", gap: 12, marginBottom: 40 }}>
                {filteredCards.length === 0 && (
                  <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No cards found.</p>
                )}
                {filteredCards.map((row) => {
                  const card = row.cardMeta
                  const market = row.market
                  const purchasePrice = row.purchasePrice

                  return (
                    <div key={row.id} style={rowBox}>
                      {row.image && (
                        <img src={row.image} alt={row.name} style={{ width: 56, borderRadius: 6 }} />
                      )}
                      <div style={{ flex: 1, color: "#ffffff" }}>
                        <strong>
                          {card?.name}
                          {card?.card_number && card?.set_total && (
                            <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
                          )}
                        </strong>{" "}
                        <span style={{ color: "#9ca3af" }}>
                          ({card?.set_name}
                          {card?.release_year && ` · ${card.release_year}`})
                        </span>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          Qty: {row.quantity} · Condition: {row.condition} · Paid: {formatPrice(purchasePrice)}
                        </div>

                        <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
                          <ThresholdRow label="85%" value={market != null ? market * 0.85 : null} purchasePrice={purchasePrice} />
                          <ThresholdRow label="90%" value={market != null ? market * 0.9 : null} purchasePrice={purchasePrice} />
                          <ThresholdRow label="95%" value={market != null ? market * 0.95 : null} purchasePrice={purchasePrice} />
                          <ThresholdRow label="Market" value={market} purchasePrice={purchasePrice} />
                        </div>
                      </div>
                      <form action={removeCardFromCollection}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rmt-remove-btn"
                          style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {typeFilter !== "card" && (
            <>
              <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                Your Sealed Products ({filteredSealed.length})
              </h2>
              <div style={{ display: "grid", gap: 12 }}>
                {filteredSealed.length === 0 && (
                  <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No sealed products found.</p>
                )}
                {filteredSealed.map((row) => {
                  const diff =
                    row.market != null && row.purchasePrice != null
                      ? row.market - row.purchasePrice
                      : null
                  return (
                    <div key={row.id} style={rowBox}>
                      {row.image && (
                        <img src={row.image} alt={row.name} style={{ width: 56, borderRadius: 6 }} />
                      )}
                      <div style={{ flex: 1, color: "#ffffff" }}>
                        <strong>{row.name}</strong>{" "}
                        <span style={{ color: "#9ca3af" }}>({row.subLabel})</span>
                        <div style={{ fontSize: 13 }}>
                          Qty: {row.quantity} · Paid: {formatPrice(row.purchasePrice)} · Market: {formatPrice(row.market)}
                        </div>
                        {diff != null && (
                          <div style={{ color: diff >= 0 ? "#4ade80" : "#f87171" }}>
                            {diff >= 0 ? "+" : ""}
                            {diff.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <form action={removeSealedFromCollection}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rmt-remove-btn"
                          style={{ backgroundColor: "#2a1414", color: "#f87171", borderRadius: 6, padding: "6px 12px", fontSize: 14, border: "none", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "cards" && <AddCardsSearch onAdded={() => setTab("collection")} />}
      {tab === "sealed" && <AddSealedSearch onAdded={() => setTab("collection")} />}
    </div>
  )
}
