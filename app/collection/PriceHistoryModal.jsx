"use client"
import { useState, useEffect } from "react"
import { getCardPriceHistory } from "./actions"

export default function PriceHistoryModal({ cardId, variant, cardName, onClose }) {
  const [range, setRange] = useState("month")
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getCardPriceHistory(cardId, variant, range).then((data) => {
      setPoints(data)
      setLoading(false)
    })
  }, [cardId, variant, range])

  const prices = points.map((p) => p.price).filter((p) => p != null)
  const max = prices.length ? Math.max(...prices) : 0
  const min = prices.length ? Math.min(...prices) : 0
  const width = 560
  const height = 220
  const padding = 34

  function xFor(i) {
    if (points.length <= 1) return padding
    return padding + (i / (points.length - 1)) * (width - padding * 2)
  }
  function yFor(price) {
    if (max === min) return height / 2
    return height - padding - ((price - min) / (max - min)) * (height - padding * 2)
  }

  const pathD =
    points.length > 1
      ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.price)}`).join(" ")
      : ""

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, maxWidth: 620, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
            {cardName} — Price History ({variant})
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["week", "month", "year"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                backgroundColor: range === r ? "#F2B705" : "#0d0d0d",
                color: range === r ? "#000" : "#ffffff",
                border: "1px solid #2a2a2a",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "#9ca3af" }}>Loading...</p>
        ) : points.length < 2 ? (
          <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
            Not enough historical data yet for this range — check back after a few more days of syncing, or run a Full Sync from your profile menu to add more history faster.
          </p>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
            <path d={pathD} fill="none" stroke="#F2B705" strokeWidth="2" />
            {points.map((p, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(p.price)} r="3" fill="#F2B705" />
            ))}
            <text x={padding} y={height - 8} fill="#9ca3af" fontSize="11">
              {points[0].recorded_at}
            </text>
            <text x={width - padding - 70} y={height - 8} fill="#9ca3af" fontSize="11">
              {points[points.length - 1].recorded_at}
            </text>
            <text x={padding} y={18} fill="#F2B705" fontSize="12">
              ${max.toFixed(2)}
            </text>
            <text x={padding} y={height - padding + 16} fill="#F2B705" fontSize="12">
              ${min.toFixed(2)}
            </text>
          </svg>
        )}
      </div>
    </div>
  )
}