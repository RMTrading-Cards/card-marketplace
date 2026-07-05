import { createClient } from "@/lib/supabase/server"
import CollectionTabs from "./CollectionTabs"

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

        <CollectionTabs myCards={myCards || []} mySealed={mySealed || []} />
      </div>
    </div>
  )
}
