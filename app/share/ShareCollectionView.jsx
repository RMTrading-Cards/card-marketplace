"use client"
import { useState, useMemo } from "react"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
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
const infoCol = { flex: "1 1 50%", minWidth: 150, color: "#ffffff" }
const controlStyle = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 16,
  boxSizing: "border-box",
}

export default function ShareCollectionView({ items }) {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    let list = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(q))
    )
    if (typeFilter !== "all") list = list.filter((item) => item.kind === typeFilter)
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "price_desc") return (b.askPrice ?? -1) - (a.askPrice ?? -1)
      if (sortBy === "price_asc") return (a.askPrice ?? Infinity) - (b.askPrice ?? Infinity)
      return 0
    })
    return list
  }, [items, query, typeFilter, sortBy])

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search by card name or set..."
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

      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
        {filtered.length} item{filtered.length === 1 ? "" : "s"}
      </p>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {filtered.length === 0 && (
          <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No items found.</p>
        )}

        {filtered.map((item) => (
          <div key={`${item.kind}-${item.id}`} style={cardBox}>
            <div style={imageCol}>
              {item.image && (
                <img src={item.image} alt={item.name} style={{ width: "100%", borderRadius: 6 }} />
              )}
            </div>
            <div style={infoCol}>
              <strong>
                {item.region === "JP" ? "JP " : ""}{item.name}
                {item.cardNumber && item.setTotal && (
                  <span style={{ color: "#9ca3af" }}> {item.cardNumber}/{item.setTotal}</span>
                )}
              </strong>{" "}
              <span style={{ color: "#9ca3af" }}>
                ({item.subLabel}{item.releaseYear && ` · ${item.releaseYear}`})
              </span>
              {item.rarity && (
                <div style={{ color: "#F2B705", fontSize: 12, marginTop: 2 }}>
                  {item.rarity}{item.variant ? ` · ${item.variant}` : ""}
                </div>
              )}
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Qty: {item.quantity}
                {item.condition && ` · Condition: ${item.condition}`}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F2B705", marginTop: 8 }}>
                Ask: {formatPrice(item.askPrice)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}