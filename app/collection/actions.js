"use server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

function buildNamePattern(token) {
  // Replace apostrophe-like characters (straight ' or curly ') with SQL '_' wildcard
  // so a search for "steven's" matches names using either style of apostrophe.
  return token.replace(/[\u2019\u2018']/g, "_")
}

export async function searchCards(query) {
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()
  const rawTokens = query.trim().split(/\s+/).filter(Boolean)
  const selectCols =
    "id, name, set_name, card_number, set_total, release_year, rarity, image_small, tcgplayer_market_price, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil, raw_skus, region"

  const numberTokens = []
  const nameTokens = []

  for (const token of rawTokens) {
    if (token.includes("/")) {
      numberTokens.push(token.split("/")[0])
    } else if (/^\d+$/.test(token)) {
      numberTokens.push(token)
    } else {
      nameTokens.push(token)
    }
  }

  let nameQuery = supabase.from("cards").select(selectCols)
  for (const token of nameTokens) {
    nameQuery = nameQuery.ilike("name", `%${buildNamePattern(token)}%`)
  }
  for (const num of numberTokens) {
    nameQuery = nameQuery.ilike("card_number", `%${num}%`)
  }

  const { data: nameMatches, error: nameError } = await nameQuery.order("name").limit(60)
  if (nameError) console.error(nameError)

  const results = nameMatches ? [...nameMatches] : []
  const haveIds = new Set(results.map((r) => r.id))

  if (results.length < 60 && nameTokens.length > 0) {
    let broadQuery = supabase.from("cards").select(selectCols)
    for (const token of nameTokens) {
      broadQuery = broadQuery.or(`name.ilike.%${buildNamePattern(token)}%,set_name.ilike.%${token}%`)
    }
    for (const num of numberTokens) {
      broadQuery = broadQuery.ilike("card_number", `%${num}%`)
    }
    const { data: broadMatches, error: broadError } = await broadQuery
      .order("name")
      .limit(60 - results.length)
    if (broadError) console.error(broadError)

    for (const row of broadMatches || []) {
      if (!haveIds.has(row.id)) {
        results.push(row)
        haveIds.add(row.id)
      }
    }
  }

  return results
}

export async function searchSealedProducts(query) {
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sealed_products")
    .select("*")
    .or(`name.ilike.%${query}%,set_name.ilike.%${query}%`)
    .order("name")
    .limit(60)

  if (error) {
    console.error(error)
    return []
  }

  return (data || []).map((p) => ({
    id: p.id,
    tcgPlayerId: p.tcgplayer_id,
    name: p.name,
    setName: p.set_name,
    imageUrl: p.image_url,
    unopenedPrice: p.market_price,
  }))
}

export async function addCardToCollection(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const cardId = formData.get("card_id")
  const condition = formData.get("condition") || "NM"
  const variant = formData.get("variant") || "Standard"
  const quantity = Number(formData.get("quantity")) || 1
  const purchasePrice = formData.get("purchase_price")
    ? Number(formData.get("purchase_price"))
    : null
  const collectionId = formData.get("collection_id") || null

  let existingQuery = supabase
    .from("user_cards")
    .select("id, quantity, created_at")
    .eq("user_id", user.id)
    .eq("card_id", cardId)
    .eq("condition", condition)
    .eq("variant", variant)
    .is("sold_at", null)

  existingQuery =
    purchasePrice == null
      ? existingQuery.is("purchase_price", null)
      : existingQuery.eq("purchase_price", purchasePrice)

  existingQuery = collectionId
    ? existingQuery.eq("collection_id", collectionId)
    : existingQuery.is("collection_id", null)

  const { data: existing, error: findError } = await existingQuery.maybeSingle()
  if (findError) throw new Error(findError.message)

  const nowIso = new Date().toISOString()

  function isSameDay(dateA, dateB) {
    const a = new Date(dateA)
    const b = new Date(dateB)
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    )
  }

  if (existing && isSameDay(existing.created_at, nowIso)) {
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
      collection_id: collectionId,
      variant,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function removeCardFromCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")

  const { data: existing, error: findError } = await supabase
    .from("user_cards")
    .select("quantity")
    .eq("id", id)
    .maybeSingle()
  if (findError) throw new Error(findError.message)

  if (existing && existing.quantity > 1) {
    const { error } = await supabase
      .from("user_cards")
      .update({ quantity: existing.quantity - 1 })
      .eq("id", id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("user_cards").delete().eq("id", id)
    if (error) throw new Error(error.message)
  }

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
  const collectionId = formData.get("collection_id") || null

  let existingQuery = supabase
    .from("user_sealed_items")
    .select("id, quantity, created_at")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .is("sold_at", null)

  existingQuery =
    purchasePrice == null
      ? existingQuery.is("purchase_price", null)
      : existingQuery.eq("purchase_price", purchasePrice)

  existingQuery = collectionId
    ? existingQuery.eq("collection_id", collectionId)
    : existingQuery.is("collection_id", null)

  const { data: existing, error: findError } = await existingQuery.maybeSingle()
  if (findError) throw new Error(findError.message)

  const nowIso = new Date().toISOString()

  function isSameDay(dateA, dateB) {
    const a = new Date(dateA)
    const b = new Date(dateB)
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    )
  }

  if (existing && isSameDay(existing.created_at, nowIso)) {
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
      collection_id: collectionId,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function removeSealedFromCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")

  const { data: existing, error: findError } = await supabase
    .from("user_sealed_items")
    .select("quantity")
    .eq("id", id)
    .maybeSingle()
  if (findError) throw new Error(findError.message)

  if (existing && existing.quantity > 1) {
    const { error } = await supabase
      .from("user_sealed_items")
      .update({ quantity: existing.quantity - 1 })
      .eq("id", id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("user_sealed_items").delete().eq("id", id)
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function getOrCreateProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (existing) {
    if (existing.email !== user.email) {
      const { data: updated } = await supabase
        .from("profiles")
        .update({ email: user.email })
        .eq("id", user.id)
        .select()
        .single()
      return updated || existing
    }
    return existing
  }

  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: user.email })
    .select()
    .single()

  return created
}

export async function updateUsername(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const username = formData.get("username")?.toString().trim() || null

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id)

  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function getOrCreateMainCollection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_main", true)
    .maybeSingle()

  if (existing) return existing

  const { data: created } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: "Main Collection", is_main: true })
    .select()
    .single()

  return created
}

export async function listCollections() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", user.id)
    .order("is_main", { ascending: false })
    .order("created_at", { ascending: true })

  return data || []
}

export async function createCollection(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const name = formData.get("name")?.toString().trim()
  if (!name) throw new Error("Name required")

  const { error } = await supabase.from("collections").insert({ user_id: user.id, name })
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function renameCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const name = formData.get("name")?.toString().trim()
  if (!name) throw new Error("Name required")

  const { error } = await supabase.from("collections").update({ name }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function deleteCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")

  const { data: target } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single()

  if (target?.is_main) throw new Error("Cannot delete your Main Collection")

  const main = await getOrCreateMainCollection()

  await supabase.from("user_cards").update({ collection_id: main.id }).eq("collection_id", id)
  await supabase.from("user_sealed_items").update({ collection_id: main.id }).eq("collection_id", id)

  const { error } = await supabase.from("collections").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function setMainCollection(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const id = formData.get("id")

  await supabase.from("collections").update({ is_main: false }).eq("user_id", user.id)
  const { error } = await supabase.from("collections").update({ is_main: true }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function setManualPrice(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const itemType = formData.get("item_type")
  const manualPrice = formData.get("manual_price")
    ? Number(formData.get("manual_price"))
    : null
  const table = itemType === "sealed" ? "user_sealed_items" : "user_cards"

  const { error } = await supabase.from(table).update({ manual_price: manualPrice }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function updateItemQuantity(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const itemType = formData.get("item_type")
  const quantity = Number(formData.get("quantity")) || 1
  const table = itemType === "sealed" ? "user_sealed_items" : "user_cards"

  const { error } = await supabase.from(table).update({ quantity }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function updateItemCondition(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const condition = formData.get("condition")

  const { error } = await supabase.from("user_cards").update({ condition }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function updateItemPurchasePrice(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const itemType = formData.get("item_type")
  const purchasePrice = formData.get("purchase_price")
    ? Number(formData.get("purchase_price"))
    : null
  const table = itemType === "sealed" ? "user_sealed_items" : "user_cards"

  const { data: current, error: findError } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single()
  if (findError) throw new Error(findError.message)

  let dupQuery = supabase
    .from(table)
    .select("id, quantity, created_at")
    .eq("user_id", current.user_id)
    .neq("id", id)
    .is("sold_at", null)

  if (itemType === "sealed") {
    dupQuery = dupQuery.eq("product_id", current.product_id)
  } else {
    dupQuery = dupQuery
      .eq("card_id", current.card_id)
      .eq("condition", current.condition)
      .eq("variant", current.variant)
  }

  dupQuery =
    current.collection_id
      ? dupQuery.eq("collection_id", current.collection_id)
      : dupQuery.is("collection_id", null)

  dupQuery =
    purchasePrice == null
      ? dupQuery.is("purchase_price", null)
      : dupQuery.eq("purchase_price", purchasePrice)

  const { data: duplicate, error: dupError } = await dupQuery.maybeSingle()
  if (dupError) throw new Error(dupError.message)

  function isSameDay(dateA, dateB) {
    const a = new Date(dateA)
    const b = new Date(dateB)
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    )
  }

  if (duplicate && isSameDay(duplicate.created_at, current.created_at)) {
    const { error: mergeError } = await supabase
      .from(table)
      .update({ quantity: duplicate.quantity + current.quantity })
      .eq("id", duplicate.id)
    if (mergeError) throw new Error(mergeError.message)

    const { error: deleteError } = await supabase.from(table).delete().eq("id", id)
    if (deleteError) throw new Error(deleteError.message)
  } else {
    const { error } = await supabase.from(table).update({ purchase_price: purchasePrice }).eq("id", id)
    if (error) throw new Error(error.message)
  }

  revalidatePath("/collection")
}

export async function sellCardItem(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const soldPrice = Number(formData.get("sold_price"))
  const soldQuantity = Number(formData.get("sold_quantity")) || 1
  if (isNaN(soldPrice)) throw new Error("Invalid sold price")

  const { data: current, error: findError } = await supabase
    .from("user_cards")
    .select("*")
    .eq("id", id)
    .single()
  if (findError) throw new Error(findError.message)

  const qtyToSell = Math.min(soldQuantity, current.quantity)

  if (qtyToSell >= current.quantity) {
    const { error } = await supabase
      .from("user_cards")
      .update({ sold_price: soldPrice, sold_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw new Error(error.message)
  } else {
    const { error: insertError } = await supabase.from("user_cards").insert({
      user_id: current.user_id,
      card_id: current.card_id,
      quantity: qtyToSell,
      purchase_price: current.purchase_price,
      condition: current.condition,
      variant: current.variant,
      collection_id: current.collection_id,
      created_at: current.created_at,
      sold_price: soldPrice,
      sold_at: new Date().toISOString(),
    })
    if (insertError) throw new Error(insertError.message)

    const { error: updateError } = await supabase
      .from("user_cards")
      .update({ quantity: current.quantity - qtyToSell })
      .eq("id", id)
    if (updateError) throw new Error(updateError.message)
  }

  revalidatePath("/collection")
}

export async function sellSealedItem(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const soldPrice = Number(formData.get("sold_price"))
  const soldQuantity = Number(formData.get("sold_quantity")) || 1
  if (isNaN(soldPrice)) throw new Error("Invalid sold price")

  const { data: current, error: findError } = await supabase
    .from("user_sealed_items")
    .select("*")
    .eq("id", id)
    .single()
  if (findError) throw new Error(findError.message)

  const qtyToSell = Math.min(soldQuantity, current.quantity)

  if (qtyToSell >= current.quantity) {
    const { error } = await supabase
      .from("user_sealed_items")
      .update({ sold_price: soldPrice, sold_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw new Error(error.message)
  } else {
    const { error: insertError } = await supabase.from("user_sealed_items").insert({
      user_id: current.user_id,
      product_id: current.product_id,
      tcgplayer_id: current.tcgplayer_id,
      name: current.name,
      set_name: current.set_name,
      product_type: current.product_type,
      image_url: current.image_url,
      market_price: current.market_price,
      quantity: qtyToSell,
      purchase_price: current.purchase_price,
      collection_id: current.collection_id,
      created_at: current.created_at,
      sold_price: soldPrice,
      sold_at: new Date().toISOString(),
    })
    if (insertError) throw new Error(insertError.message)

    const { error: updateError } = await supabase
      .from("user_sealed_items")
      .update({ quantity: current.quantity - qtyToSell })
      .eq("id", id)
    if (updateError) throw new Error(updateError.message)
  }

  revalidatePath("/collection")
}

export async function clearSoldHistory(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const collectionId = formData.get("collection_id")

  await supabase
    .from("user_cards")
    .delete()
    .eq("user_id", user.id)
    .eq("collection_id", collectionId)
    .not("sold_at", "is", null)

  await supabase
    .from("user_sealed_items")
    .delete()
    .eq("user_id", user.id)
    .eq("collection_id", collectionId)
    .not("sold_at", "is", null)

  revalidatePath("/collection")
}

export async function removeSoldItem(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const itemType = formData.get("item_type")
  const table = itemType === "sealed" ? "user_sealed_items" : "user_cards"

  const { error } = await supabase.from(table).delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function getOrCreateShareSlug(formData) {
  const supabase = await createClient()
  const id = formData.get("id")

  const { data: existing, error: findError } = await supabase
    .from("collections")
    .select("share_slug")
    .eq("id", id)
    .single()
  if (findError) throw new Error(findError.message)

  if (existing.share_slug) return existing.share_slug

  const slug = Array.from({ length: 12 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("")

  const { error } = await supabase
    .from("collections")
    .update({ share_slug: slug })
    .eq("id", id)
  if (error) throw new Error(error.message)

  return slug
}

export async function addManualCard(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const cardId = `manual-${crypto.randomUUID()}`

  const { error: cardError } = await supabase.from("cards").insert({
    id: cardId,
    name: formData.get("name"),
    set_name: formData.get("set_name") || null,
    card_type: formData.get("card_type") || null,
    rarity: formData.get("rarity") || null,
    image_small: formData.get("image_url") || null,
    image_large: formData.get("image_url") || null,
    tcgplayer_market_price: formData.get("market_price") ? Number(formData.get("market_price")) : null,
    is_manual: true,
    is_graded: formData.get("is_graded") === "yes",
    grade_value: formData.get("is_graded") === "yes" ? formData.get("grade_value") : null,
    region: "MANUAL",
  })
  if (cardError) throw new Error(cardError.message)

  const { error: userCardError } = await supabase.from("user_cards").insert({
    user_id: user.id,
    card_id: cardId,
    quantity: Number(formData.get("quantity")) || 1,
    condition: formData.get("condition") || "NM",
    purchase_price: formData.get("purchase_price") ? Number(formData.get("purchase_price")) : null,
    manual_price: formData.get("ask_price") ? Number(formData.get("ask_price")) : null,
    variant: "Standard",
    collection_id: formData.get("collection_id") || null,
  })
  if (userCardError) throw new Error(userCardError.message)

  revalidatePath("/collection")
}

export async function refreshCardsData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    throw new Error("Not authorized")
  }

  const res = await fetch("https://www.rmtradingcards.com/api/cron/sync-cards", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const json = await res.json()
  revalidatePath("/collection")
  return json
}

export async function refreshSealedData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    throw new Error("Not authorized")
  }

  const res = await fetch("https://www.rmtradingcards.com/api/cron/sync-sealed", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const json = await res.json()
  revalidatePath("/collection")
  return json
}