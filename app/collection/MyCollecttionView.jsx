"use client"
import { useState, useMemo } from "react"
import { removeCardFromCollection } from "./actions"

function formatPrice(n) {
  return n == null ? "—" : `$${n.toFixed(2)}`
}

export default function MyCollectionView({ initialCards }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("price_desc")

  const filtered = useMemo(() => {
    let list = initialCards.filter((item) =>
      item.cards?.name?.toLowerCase().includes(query.toLowerCase())
    )
    list.sort((a, b) => {
      const priceA = a.cards?.tcgplayer_market_price ?? 0
      const priceB = b.cards?.tcgplayer_market_price ?? 0
      if (sort === "price_desc") return priceB - priceA
      if (sort === "price_asc") return priceA - priceB
      if (sort === "name") return (a.cards?.name || "").localeCompare(b.cards?.name || "")
      return 0
    })
    return list
  }, [initialCards, query, sort])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-white">
          My Collection ({initialCards.length})
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search your cards..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-[#141414] border border-[#2a2a2a] text-white placeholder-gray-500
                       rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F2B705]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[#141414] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="price_desc">Price High → Low</option>
            <option value="price_asc">Price Low → High</option>
            <option value="name">Name A → Z</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 italic text-center py-12">No cards found.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item) => {
          const card = item.cards
          const market = card?.tcgplayer_market_price
          const gainLoss =
            market != null && item.purchase_price != null
              ? (market - item.purchase_price) * item.quantity
              : null

          return (
            <div
              key={item.id}
              className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 flex flex-col"
            >
              {card?.image_small && (
                <img src={card.image_small} alt={card.name} className="rounded mb-2" />
              )}
              <div className="text-white text-sm font-medium truncate">{card?.name}</div>
              <div className="text-gray-500 text-xs truncate mb-2">{card?.set_name}</div>

              <div className="text-xs text-gray-400 space-y-0.5 mb-2">
                <div>Qty {item.quantity} · {item.condition}</div>
                <div>Paid: {formatPrice(item.purchase_price)}</div>
                <div>Market: <span className="text-[#F2B705]">{formatPrice(market)}</span></div>
              </div>

              {gainLoss != null && (
                <div
                  className={`text-xs font-semibold mb-2 ${
                    gainLoss >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {gainLoss >= 0 ? "+" : ""}
                  {gainLoss.toFixed(2)}
                </div>
              )}

              <form action={removeCardFromCollection} className="mt-auto">
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="w-full text-xs bg-[#2a1414] text-red-400 rounded px-2 py-1
                             hover:bg-[#3a1a1a] transition-colors"
                >
                  Remove
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}