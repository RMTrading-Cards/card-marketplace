"use server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function searchCards(query) {
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()
  const tokens = query.trim().split(/\s+/).filter(Boolean)

  let q = supabase
    .from("cards")
    .select("id, name, set_name, card_number, set_total, release_year, rarity, image_small, tcgplayer_market_price")

  for (const token of tokens) {
    if (token.includes("/")) {
      const [num] = token.split("/")
      q = q.or(
        `card_number.ilike.%${num}%,name.ilike.%${token}%,set_name.ilike.%${token}%`
      )
    } else {
      q = q.or(
        `name.ilike.%${token}%,set_name.ilike.%${token}%,card_number.ilike.%${token}%`
      )
    }
  }

  const { data, error } = await q.order("name").limit(20)
  if (error) {
    console.error(error)
    return []
  }
  return data
}

export async function searchSealedProducts(query) {
  if (!query || query.trim().length < 2) return []
  try {
    const res = await fetch(
      `https://www.pokemonpricetracker.com/api/v2/sealed-products?search=${encodeURIComponent(query)}&limit=10`,
      { headers: { Authorization: `Bearer ${process.env.POKEMONPRICETRACKER_API_KEY}` } }
    )
    if (!res.ok) {
      const body = await res.text()
      console.error("Sealed search failed", res.status, body)
      return []
    }
    const json = await res.json()
    return json.data || []
  } catch (err) {
    console.error(err)
    return []
  }
}

export async function addCardToCollection(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const cardId = formData.get("card_id")
  const condition = formData.get("condition") || "NM"
  const quantity = Number(formData.get("quantity")) || 1
  const purchasePrice = formData.get("purchase_price")
    ? Number(formData.get("purchase_price"))
    : null

  const { data: existing, error: findError } = await supabase
    .from("user_cards")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("card_id", cardId)
    .eq("condition", condition)
    .maybeSingle()

  if (findError) throw new Error(findError.message)

  if (existing) {
    const { error } = await supabase
      .from("user_cards")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("user_cards").insert({
      user_id: user.id,
      card_id: cardId,
      quantity,
      purchase_price: purchasePrice,
      condition,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function removeCardFromCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const { error } = await supabase.from("user_cards").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function addSealedToCollection(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const productId = formData.get("product_id")
  const quantity = Number(formData.get("quantity")) || 1
  const purchasePrice = formData.get("purchase_price")
    ? Number(formData.get("purchase_price"))
    : null

  const { data: existing, error: findError } = await supabase
    .from("user_sealed_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle()

  if (findError) throw new Error(findError.message)

  if (existing) {
    const { error } = await supabase
      .from("user_sealed_items")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("user_sealed_items").insert({
      user_id: user.id,
      product_id: productId,
      tcgplayer_id: formData.get("tcgplayer_id"),
      name: formData.get("name"),
      set_name: formData.get("set_name"),
      image_url: formData.get("image_url"),
      market_price: formData.get("market_price")
        ? Number(formData.get("market_price"))
        : null,
      quantity,
      purchase_price: purchasePrice,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function removeSealedFromCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const { error } = await supabase.from("user_sealed_items").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}