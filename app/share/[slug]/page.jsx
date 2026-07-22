import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import ShareCollectionView from "../ShareCollectionView"

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

  const cardItems = (cards || []).map((item) => {
    const card = item.cards
    const market = getVariantPrice(card, item.variant)
    return {
      kind: "card",
      id: item.id,
      name: card?.name || "",
      subLabel: card?.set_name,
      image: card?.image_small,
      cardNumber: card?.card_number,
      setTotal: card?.set_total,
      releaseYear: card?.release_year,
      rarity: card?.rarity,
      variant: item.variant,
      region: card?.region,
      quantity: item.quantity,
      condition: item.condition,
      askPrice: item.manual_price ?? market,
    }
  })

  const sealedItems = (sealed || []).map((item) => ({
    kind: "sealed",
    id: item.id,
    name: item.name,
    subLabel: item.set_name,
    image: item.image_url,
    quantity: item.quantity,
    askPrice: item.manual_price ?? item.market_price,
  }))

  const allItems = [...cardItems, ...sealedItems]

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

        <ShareCollectionView items={allItems} />
      </div>
    </div>
  )
}