"use client"
import { useState } from "react"
import AddCardsSearch from "./AddCardsSearch"
import AddSealedSearch from "./AddSealedSearch"
import { removeCardFromCollection, removeSealedFromCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "—" : `$${n.toFixed(2)}`
}

function ThresholdRow({ label, value, purchasePrice, quantity }) {
  if (value == null) return null
  const diff =
    purchasePrice != null ? (value - purchasePrice) * quantity : null

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

export default function CollectionTabs({ myCards, mySealed }) {
  const [tab, setTab] = useState("collection")

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
          <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Your Cards ({myCards?.length ?? 0})
          </h2>
          <div style={{ display: "grid", gap: 12, marginBottom: 40 }}>
            {myCards?.map((item) => {
              const card = item.cards
              const market = card?.tcgplayer_market_price
              const quantity = item.quantity
              const purchasePrice = item.purchase_price

              return (
                <div key={item.id} style={rowBox}>
                  {card?.image_small && (
                    <img src={card.image_small} alt={card.name} style={{ width: 56, borderRadius: 6 }} />
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
                      Qty: {quantity} · Condition: {item.condition} · Paid: {formatPrice(purchasePrice)}
                    </div>

                    <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
                      <ThresholdRow label="85%" value={market != null ? market * 0.85 : null} purchasePrice={purchasePrice} quantity={quantity} />
                      <ThresholdRow label="90%" value={market != null ? market * 0.9 : null} purchasePrice={purchasePrice} quantity={quantity} />
                      <ThresholdRow label="95%" value={market != null ? market * 0.95 : null} purchasePrice={purchasePrice} quantity={quantity} />
                      <ThresholdRow label="Market" value={market} purchasePrice={purchasePrice} quantity={quantity} />
                    </div>
                  </div>
                  <form action={removeCardFromCollection}>
                    <input type="hidden" name="id" value={item.id} />
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

          <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Your Sealed Products ({mySealed?.length ?? 0})
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {mySealed?.map((item) => {
              const diff =
                item.market_price != null && item.purchase_price != null
                  ? (item.market_price - item.purchase_price) * item.quantity
                  : null
              return (
                <div key={item.id} style={rowBox}>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} style={{ width: 56, borderRadius: 6 }} />
                  )}
                  <div style={{ flex: 1, color: "#ffffff" }}>
                    <strong>{item.name}</strong>{" "}
                    <span style={{ color: "#9ca3af" }}>({item.set_name})</span>
                    <div style={{ fontSize: 13 }}>
                      Qty: {item.quantity} · Paid: {formatPrice(item.purchase_price)} · Market: {formatPrice(item.market_price)}
                    </div>
                    {diff != null && (
                      <div style={{ color: diff >= 0 ? "#4ade80" : "#f87171" }}>
                        {diff >= 0 ? "+" : ""}
                        {diff.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <form action={removeSealedFromCollection}>
                    <input type="hidden" name="id" value={item.id} />
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
        </div>
      )}

      {tab === "cards" && <AddCardsSearch onAdded={() => setTab("collection")} />}
      {tab === "sealed" && <AddSealedSearch onAdded={() => setTab("collection")} />}
    </div>
  )
}
