import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"

function formatPrice(n) {
  return n == null ? "N/A" : `$${n.toFixed(2)}`
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

export default async function SharedCollectionPage({ params }) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name")
    .eq("share_slug", slug)
    .maybeSingle()

  if (!collection) notFound()

  const { data: cards } = await supabase
    .from("user_cards")
    .select(
      "id, quantity, condition, variant, manual_price, cards(name, image_small, set_name, card_number, set_total, release_year, rarity, tcgplayer_market_price, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil, region)"
    )
    .eq("collection_id", collection.id)
    .is("sold_at", null)

  const { data: sealed } = await supabase
    .from("user_sealed_items")
    .select("id, name, set_name, image_url, quantity, market_price, manual_price")
    .eq("collection_id", collection.id)
    .is("sold_at", null)

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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
          <span style={{ color: "#F2B705" }}>RMT</span>
          <span style={{ color: "#ffffff" }}>rading Cards</span>
        </h1>
        <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
          {collection.name}
        </h2>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {(cards || []).map((item) => {
            const card = item.cards
            const market = getVariantPrice(card, item.variant)
            const askPrice = item.manual_price ?? market

            return (
              <div key={`card-${item.id}`} style={cardBox}>
                <div style={imageCol}>
                  {card?.image_small && (
                    <img src={card.image_small} alt={card.name} style={{ width: "100%", borderRadius: 6 }} />
                  )}
                </div>
                <div style={infoCol}>
                  <strong>
                    {card?.region === "JP" ? "JP " : ""}{card?.name}
                    {card?.card_number && card?.set_total && (
                      <span style={{ color: "#9ca3af" }}> {card.card_number}/{card.set_total}</span>
                    )}
                  </strong>{" "}
                  <span style={{ color: "#9ca3af" }}>
                    ({card?.set_name}{card?.release_year && ` · ${card.release_year}`})
                  </span>
                  {card?.rarity && (
                    <div style={{ color: "#F2B705", fontSize: 12, marginTop: 2 }}>
                      {card.rarity} · {item.variant || "Standard"}
                    </div>
                  )}
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    Qty: {item.quantity} · Condition: {item.condition}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F2B705", marginTop: 8 }}>
                    Ask: {formatPrice(askPrice)}
                  </div>
                </div>
              </div>
            )
          })}

          {(sealed || []).map((item) => {
            const askPrice = item.manual_price ?? item.market_price
            return (
              <div key={`sealed-${item.id}`} style={cardBox}>
                <div style={imageCol}>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} style={{ width: "100%", borderRadius: 6 }} />
                  )}
                </div>
                <div style={infoCol}>
                  <strong>{item.name}</strong>{" "}
                  <span style={{ color: "#9ca3af" }}>({item.set_name})</span>
                  <div style={{ fontSize: 13, marginTop: 6 }}>Qty: {item.quantity}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F2B705", marginTop: 8 }}>
                    Ask: {formatPrice(askPrice)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {(cards || []).length === 0 && (sealed || []).length === 0 && (
          <p style={{ color: "#9ca3af", fontStyle: "italic" }}>This collection is empty.</p>
        )}
      </div>
    </div>
  )
}