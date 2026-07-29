"use client"

import { useEffect, useMemo, useState } from "react"
import { getCardPriceHistory } from "./action"
import EbaySoldButton from "./EbaySoldButton"

const RANGES = ["week", "month", "year"]

export default function PriceHistoryModal(props) {
  const { cardName, cardNumber, variant, condition, isGraded, gradeValue, onClose } = props

  const cardId =
    props.cardId ??
    props.card_id ??
    (props.card ? props.card.card_id ?? props.card.id : null)

  const [range, setRange] = useState("week")
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const isManual = typeof cardId === "string" && cardId.indexOf("manual-") === 0

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)

      if (!cardId) {
        setPoints([])
        setLoadError("No cardId was passed to PriceHistoryModal.")
        setLoading(false)
        return
      }

      if (isManual) {
        setPoints([])
        setLoading(false)
        return
      }

      try {
        const rows = await getCardPriceHistory(cardId, variant, range)

        const byDay = new Map()
        for (const r of rows || []) {
          const day = String(r.recorded_at).slice(0, 10)
          const price = Number(r.price)
          if (Number.isFinite(price)) byDay.set(day, price)
        }

        const cleaned = Array.from(byDay.entries())
          .map((entry) => ({ recorded_at: entry[0], price: entry[1] }))
          .sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1))

        if (!cancelled) setPoints(cleaned)
      } catch (err) {
        if (!cancelled) {
          setPoints([])
          setLoadError(err && err.message ? err.message : "Failed to load price history.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [cardId, variant, range, isManual])

  const W = 560
  const H = 250
  const L = 56
  const R = W - 16
  const T = 24
  const B = H - 36

  const chart = useMemo(() => {
    if (points.length === 0) return null

    const toMs = (d) => new Date(d + "T00:00:00").getTime()
    const today = new Date().toISOString().slice(0, 10)
    const single = points.length === 1

    const xs = points.map((p) => toMs(p.recorded_at))
    const prices = points.map((p) => p.price)

    const domainStart = Math.min.apply(null, xs)
    const domainEnd = Math.max(Math.max.apply(null, xs), toMs(today))
    const span = domainEnd - domainStart || 1

    let min = Math.min.apply(null, prices)
    let max = Math.max.apply(null, prices)
    if (max === min) {
      const pad = Math.max(max * 0.08, 0.5)
      max = max + pad
      min = Math.max(min - pad, 0)
    }

    const xFor = (d) =>
      single ? (L + R) / 2 : L + ((toMs(d) - domainStart) / span) * (R - L)
    const yFor = (v) => B - ((v - min) / (max - min)) * (B - T)

    const pathD = points
      .map((p, i) => (i === 0 ? "M " : "L ") + xFor(p.recorded_at) + " " + yFor(p.price))
      .join(" ")

    const first = points[0]
    const last = points[points.length - 1]

    const areaD = single
      ? null
      : pathD +
        " L " + xFor(last.recorded_at) + " " + B +
        " L " + xFor(first.recorded_at) + " " + B + " Z"

    const change = single ? 0 : last.price - first.price
    const pct = !single && first.price > 0 ? (change / first.price) * 100 : 0

    return {
      single: single,
      xFor: xFor,
      yFor: yFor,
      pathD: pathD,
      areaD: areaD,
      min: min,
      max: max,
      mid: (min + max) / 2,
      first: first,
      last: last,
      change: change,
      pct: pct,
    }
  }, [points])

  const fmtShort = (d) => {
    const parts = String(d).slice(0, 10).split("-")
    return parts[1] + "/" + parts[2]
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: 20,
          maxWidth: 620,
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 12,
          }}
        >
          <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, margin: 0 }}>
            {cardName} - Price History ({variant})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        <EbaySoldButton
          card={{ name: cardName, card_number: cardNumber }}
          variant={variant}
          condition={condition}
          isGraded={isGraded}
          gradeValue={gradeValue}
          style={{ marginBottom: 12, fontSize: 13, padding: "6px 12px" }}
        />

        {!isManual ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {RANGES.map((r) => (
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
        ) : null}

        {loading ? (
          <p style={{ color: "#9ca3af" }}>Loading...</p>
        ) : loadError ? (
          <p style={{ color: "#f87171", fontSize: 13, fontFamily: "monospace" }}>
            {loadError}
          </p>
        ) : isManual ? (
          <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 13 }}>
            This is a manually added card, so it has no catalog price history. Use the eBay
            sold search above to check recent comps.
          </p>
        ) : !chart ? (
          <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 13 }}>
            No price history recorded for this card yet. Snapshots start accumulating once
            the daily sync has covered this set.
          </p>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>
                ${chart.last.price.toFixed(2)}
              </span>
              {!chart.single ? (
                <span
                  style={{
                    color: chart.change >= 0 ? "#4ade80" : "#f87171",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {chart.change >= 0 ? "+" : "-"}${Math.abs(chart.change).toFixed(2)} (
                  {chart.pct.toFixed(1)}%)
                </span>
              ) : null}
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                as of {chart.last.recorded_at}
              </span>
            </div>

            <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto" }}>
              {[chart.max, chart.mid, chart.min].map((v, i) => {
                const y = chart.yFor(v)
                return (
                  <g key={i}>
                    <line x1={L} y1={y} x2={R} y2={y} stroke="#2a2a2a" strokeWidth="1" />
                    <text
                      x={L - 8}
                      y={y + 4}
                      fill="#9ca3af"
                      fontSize="11"
                      textAnchor="end"
                    >
                      ${v.toFixed(2)}
                    </text>
                  </g>
                )
              })}

              {chart.areaD ? (
                <path d={chart.areaD} fill="rgba(242,183,5,0.12)" stroke="none" />
              ) : null}

              {!chart.single ? (
                <path
                  d={chart.pathD}
                  fill="none"
                  stroke="#F2B705"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}

              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={chart.xFor(p.recorded_at)}
                  cy={chart.yFor(p.price)}
                  r="3.5"
                  fill="#F2B705"
                >
                  <title>{p.recorded_at + " - $" + p.price.toFixed(2)}</title>
                </circle>
              ))}

              <text x={L} y={H - 12} fill="#9ca3af" fontSize="11" textAnchor="start">
                {fmtShort(chart.first.recorded_at)}
              </text>
              {!chart.single ? (
                <text x={R} y={H - 12} fill="#9ca3af" fontSize="11" textAnchor="end">
                  {fmtShort(chart.last.recorded_at)}
                </text>
              ) : null}
            </svg>

            <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
              {points.length} snapshot{points.length === 1 ? "" : "s"} in this range.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}