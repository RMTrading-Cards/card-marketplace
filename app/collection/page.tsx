import { createClient } from "@/lib/supabase/server"
import CollectionTabs from "./CollectionTabs"
import ProfileMenu from "./ProfileMenu"
import { getOrCreateProfile, getOrCreateMainCollection, listCollections } from "./actions"

export default async function Collection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getOrCreateProfile()
  const isAdmin = user!.id === process.env.ADMIN_USER_ID
  await getOrCreateMainCollection()
  const collections = await listCollections()
  const mainCollection = collections.find((c) => c.is_main)

  const { data: myCards } = await supabase
    .from("user_cards")
    .select(
      "id, quantity, purchase_price, condition, collection_id, manual_price, variant, created_at, sold_price, sold_at, cards(name, image_small, tcgplayer_market_price, set_name, card_number, set_total, release_year, rarity, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil, raw_skus, region)"
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <h1 className="text-4xl font-black">
            <span className="text-[#F2B705]">RMT</span>
            <span className="text-white">rading Cards</span>
          </h1>
          <ProfileMenu email={user!.email} username={profile?.username} isAdmin={isAdmin} />
        </div>

        <CollectionTabs
          myCards={myCards || []}
          mySealed={mySealed || []}
          collections={collections}
          mainCollectionId={mainCollection?.id}
        />
      </div>
    </div>
  )
}
