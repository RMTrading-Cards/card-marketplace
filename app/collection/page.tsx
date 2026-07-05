import { createClient } from "@/lib/supabase/server"
import AddItemsSearch from "./AddItemsSearch"
import { removeCardFromCollection, removeSealedFromCollection } from "./actions"

function formatPrice(n: number | null | undefined) {
  return n == null ? "—" : `$${n.toFixed(2)}`
}

function ThresholdRow({
  label,
  value,
  purchasePrice,
  quantity,
}: {
  label: string
  value: number | null | undefined
  purchasePrice: number | null | undefined
  quantity: number
}) {
  if (value == null) return null
  const diff =
    purchasePrice != null ? (value - purchasePrice) * quantity : null

  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-300">{label}: {formatPrice(value)}</span>
      {diff != null && (
        <span className={diff >= 0 ? "text-green-400" : "text-red-400"} style={{ marginLeft: 8 }}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)}
        </span>
      )}
    </div>
  )
}

export default async function Collection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: myCards } = await supabase
    .from("user_cards")
    .select(
      "id, quantity, purchase_price, condition, cards(name, image_small, tcgplayer_market_price, set_name, card_number, set_total, release_year)"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const { data: mySealed } = await supabase
    .from("user_sealed_items")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-black mb-10">
          <span className="text-[#F2B705]">RMT</span>
          <span className="text-white">rading Cards</span>
        </h1>

        <h2 className="text-xl font-bold text-white mb-3">Add Items</h2>
        <AddItemsSearch />

        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Your Cards ({myCards?.length ?? 0})
        </h2>
        <div className="grid gap-3 mb-10">
          {myCards?.map((item: any) => {
            const card = item.cards
            const market = card?.tcgplayer_market_price
            const quantity = item.quantity
            const purchasePrice = item.purchase_price

            return (
              <div
                key={item.id}
                className="flex gap-4 items-center bg-[#141414] border border-[#2a2a2a] rounded-lg p-3"
              >
                {card?.image_small && (
                  <img src={card.image_small} alt={card.name} className="w-14 rounded" />
                )}
                <div className="flex-1 text-white">
                  <strong>
                    {card?.name}
                    {card?.card_number && card?.set_total && (
                      <span className="text-gray-400"> {card.card_number}/{card.set_total}</span>
                    )}
                  </strong>{" "}
                  <span className="text-gray-400">
                    ({card?.set_name}
                    {card?.release_year && ` · ${card.release_year}`})
                  </span>
                  <div className="text-sm mb-1">
                    Qty: {quantity} · Condition: {item.condition} · Paid:{" "}
                    {formatPrice(purchasePrice)}
                  </div>

                  <div className="space-y-0.5" style={{ maxWidth: 260 }}>
                    <ThresholdRow
                      label="85%"
                      value={market != null ? market * 0.85 : null}
                      purchasePrice={purchasePrice}
                      quantity={quantity}
                    />
                    <ThresholdRow
                      label="90%"
                      value={market != null ? market * 0.9 : null}
                      purchasePrice={purchasePrice}
                      quantity={quantity}
                    />
                    <ThresholdRow
                      label="95%"
                      value={market != null ? market * 0.95 : null}
                      purchasePrice={purchasePrice}
                      quantity={quantity}
                    />
                    <ThresholdRow
                      label="Market"
                      value={market}
                      purchasePrice={purchasePrice}
                      quantity={quantity}
                    />
                  </div>
                </div>
                <form action={removeCardFromCollection}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="bg-[#2a1414] rounded px-3 py-1.5 text-sm hover:bg-[#3a1a1a] transition-colors"
                    style={{ color: "#f87171" }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            )
          })}
        </div>

        <h2 className="text-xl font-bold text-white mt-10 mb-3">
          Your Sealed Products ({mySealed?.length ?? 0})
        </h2>
        <div className="grid gap-3">
          {mySealed?.map((item: any) => {
            const diff =
              item.market_price != null && item.purchase_price != null
                ? (item.market_price - item.purchase_price) * item.quantity
                : null
            return (
              <div
                key={item.id}
                className="flex gap-4 items-center bg-[#141414] border border-[#2a2a2a] rounded-lg p-3"
              >
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-14 rounded" />
                )}
                <div className="flex-1 text-white">
                  <strong>{item.name}</strong>{" "}
                  <span className="text-gray-400">({item.set_name})</span>
                  <div className="text-sm">
                    Qty: {item.quantity} · Paid:{" "}
                    {formatPrice(item.purchase_price)} · Market:{" "}
                    {formatPrice(item.market_price)}
                  </div>
                  {diff != null && (
                    <div className={diff >= 0 ? "text-green-400" : "text-red-400"}>
                      {diff >= 0 ? "+" : ""}
                      {diff.toFixed(2)}
                    </div>
                  )}
                </div>
                <form action={removeSealedFromCollection}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="bg-[#2a1414] rounded px-3 py-1.5 text-sm hover:bg-[#3a1a1a] transition-colors"
                    style={{ color: "#f87171" }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
