"use client"
import { useState, useTransition } from "react"
import {
  searchCards,
  searchSealedProducts,
  addCardToCollection,
  addSealedToCollection,
} from "./actions"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
}

function CardCard({ card }) {
  const market = card.tcgplayer_market_price
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-3">
      {card.image_small && (
        <img src={card.image_small} alt={card.name} className="w-full rounded mb-2" />
      )}
      <p className="text-white font-semibold text-sm mb-1">
        {card.name}
        {card.card_number && card.set_total && (
          <span className="text-gray-400"> {card.card_number}/{card.set_total}</span>
        )}
      </p>
      <p className="text-gray-400 text-xs mb-1">
        {card.set_name}
        {card.release_year && ` · ${card.release_year}`}
      </p>
      {card.rarity && (
        <p className="text-xs mb-2" style={{ color: "#F2B705" }}>{card.rarity}</p>
      )}
      <p className="text-white text-sm mb-2 flex justify-between" style={{ maxWidth: 220 }}>
        <span>Market: {formatPrice(market)}</span>
        {market != null && parsedPrice != null && (
          <span className={(market - parsedPrice) * quantity >= 0 ? "text-green-400" : "text-red-400"}>
            {(market - parsedPrice) * quantity >= 0 ? "+" : ""}
            {((market - parsedPrice) * quantity).toFixed(2)}
          </span>
        )}
      </p>

      {market != null && (
        <div className="mb-3 space-y-0.5" style={{ fontSize: "11px" }}>
          {thresholds.map((pct) => {
            const value = market * pct
            const diff =
              parsedPrice != null ? (value - parsedPrice) * quantity : null
            return (
              <div key={pct} className="flex justify-between text-gray-300">
                <span>{Math.round(pct * 100)}% = {formatPrice(value)}</span>
                {diff != null && (
                  <span
                    className={diff >= 0 ? "text-green-400" : "text-red-400"}
                    style={{ marginLeft: 8 }}
                  >
                    {diff >= 0 ? "+" : ""}
                    {diff.toFixed(2)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <form action={addCardToCollection} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input type="hidden" name="card_id" value={card.id} />
        <input
          name="quantity"
          type="number"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded px-2 py-1 text-sm"
        />
        <select
          name="condition"
          defaultValue="NM"
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded px-2 py-1 text-sm"
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
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded px-2 py-1 text-sm"
        />
        <button
          type="submit"
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "14px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Add to Collection
        </button>
      </form>
    </div>
  )
}

function SealedCard({ product }) {
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState("")
  const parsedPrice = purchasePrice === "" ? null : Number(purchasePrice)
  const diff =
    parsedPrice != null ? (product.unopenedPrice - parsedPrice) * quantity : null

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

      <form action={addSealedToCollection} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "14px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Add to Collection
        </button>
      </form>
    </div>
  )
}

export default function AddItemsSearch() {
  const [tab, setTab] = useState("cards")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function runSearch(value, activeTab) {
    startTransition(async () => {
      const data =
        activeTab === "cards"
          ? await searchCards(value)
          : await searchSealedProducts(value)
      setResults(data || [])
    })
  }

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    runSearch(value, tab)
  }

  function handleTabChange(newTab) {
    setTab(newTab)
    setResults([])
    if (query.length >= 2) runSearch(query, newTab)
  }

  const tabStyle = (active) => ({
    padding: "8px 18px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid #2a2a2a",
    backgroundColor: active ? "#F2B705" : "#141414",
    color: active ? "#000000" : "#ffffff",
  })

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button style={tabStyle(tab === "cards")} onClick={() => handleTabChange("cards")}>
          Add Cards
        </button>
        <button style={tabStyle(tab === "sealed")} onClick={() => handleTabChange("sealed")}>
          Add Sealed
        </button>
      </div>

      <input
        type="text"
        placeholder={tab === "cards" ? "Search cards..." : "Search booster boxes, ETBs, etc..."}
        value={query}
        onChange={handleChange}
        className="w-full max-w-xl bg-[#141414] border border-[#2a2a2a] text-white placeholder-gray-400
                   rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-[#F2B705]"
      />
      {isPending && <p className="text-white mb-4">Searching...</p>}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {results.map((item) =>
          tab === "sealed" ? (
            <SealedCard key={`sealed-${item.id}`} product={item} />
          ) : (
            <CardCard key={`card-${item.id}`} card={item} />
          )
        )}
      </div>
    </div>
  )
}