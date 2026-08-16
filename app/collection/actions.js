"use server"
import { createClient } from "@/lib/supabase/server"
import { createPublicClient } from "@/lib/supabase/public"
import { revalidatePath, unstable_cache } from "next/cache"
import { Jimp, intToRGBA } from "jimp"

function buildNamePattern(token) {
  return token.replace(/[\u2019\u2018']/g, "_")
}

const cachedSearchCards = unstable_cache(
  async (query, sortBy, page, pageSize, regionFilter) => {
    const supabase = createPublicClient()
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

    let q = supabase.from("cards").select(selectCols, { count: "exact" })
    for (const token of nameTokens) {
      q = q.ilike("name", `%${buildNamePattern(token)}%`)
    }
    for (const num of numberTokens) {
      q = q.ilike("card_number", `%${num}%`)
    }
    if (regionFilter) {
      q = q.eq("region", regionFilter)
    }
    if (sortBy === "price_desc") {
      q = q.order("tcgplayer_market_price", { ascending: false, nullsFirst: false })
    } else if (sortBy === "price_asc") {
      q = q.order("tcgplayer_market_price", { ascending: true, nullsFirst: false })
    } else {
      q = q.order("name")
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) {
      console.error(error)
      return { results: [], totalCount: 0 }
    }
    return { results: data || [], totalCount: count || 0 }
  },
  ["search-cards"],
  { revalidate: 60 }
)

export async function searchCards(query, sortBy = "name", page = 1, pageSize = 20, regionFilter = null) {
  if (!query || query.trim().length < 2) return { results: [], totalCount: 0 }
  return cachedSearchCards(query.trim().toLowerCase(), sortBy, page, pageSize, regionFilter)
}

const cachedSearchSealedProducts = unstable_cache(
  async (query, sortBy, page, pageSize, regionFilter) => {
    const supabase = createPublicClient()
    const tokens = query.trim().split(/\s+/).filter(Boolean)

    let q = supabase.from("sealed_products").select("*", { count: "exact" })
    for (const token of tokens) {
      q = q.or(`name.ilike.%${token}%,set_name.ilike.%${token}%`)
    }
    if (regionFilter) {
      q = q.eq("region", regionFilter)
    }
    if (sortBy === "price_desc") {
      q = q.order("market_price", { ascending: false, nullsFirst: false })
    } else if (sortBy === "price_asc") {
      q = q.order("market_price", { ascending: true, nullsFirst: false })
    } else {
      q = q.order("name")
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) {
      console.error(error)
      return { results: [], totalCount: 0 }
    }

    const results = (data || []).map((p) => ({
      id: p.id,
      tcgPlayerId: p.tcgplayer_id,
      name: p.name,
      setName: p.set_name,
      imageUrl: p.image_url,
      unopenedPrice: p.market_price,
    }))

    return { results, totalCount: count || 0 }
  },
  ["search-sealed"],
  { revalidate: 60 }
)

export async function searchSealedProducts(query, sortBy = "name", page = 1, pageSize = 20, regionFilter = null) {
  if (!query || query.trim().length < 2) return { results: [], totalCount: 0 }
  return cachedSearchSealedProducts(query.trim().toLowerCase(), sortBy, page, pageSize, regionFilter)
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
  const isGraded = formData.get("is_graded") === "yes"
  const gradeValue = isGraded ? formData.get("grade_value") || null : null

  let existingQuery = supabase
    .from("user_cards")
    .select("id, quantity, created_at")
    .eq("user_id", user.id)
    .eq("card_id", cardId)
    .eq("condition", condition)
    .eq("variant", variant)
    .eq("is_graded", isGraded)
    .is("sold_at", null)

  existingQuery = gradeValue
    ? existingQuery.eq("grade_value", gradeValue)
    : existingQuery.is("grade_value", null)

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
      is_graded: isGraded,
      grade_value: gradeValue,
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

export async function mergeCollectionIntoMain(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const id = formData.get("id")

  const { data: target } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single()

  if (target?.is_main) throw new Error("This is already your Main Collection")

  const main = await getOrCreateMainCollection()

  await supabase.from("user_cards").update({ collection_id: main.id }).eq("collection_id", id)
  await supabase.from("user_sealed_items").update({ collection_id: main.id }).eq("collection_id", id)

  const { error } = await supabase.from("collections").delete().eq("id", id)
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

const getKnownSetAbbrs = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from("cards")
      .select("set_abbr")
      .not("set_abbr", "is", null)

    const unique = {}
    for (const row of data || []) {
      if (row.set_abbr) unique[row.set_abbr.toUpperCase()] = true
    }
    return unique
  },
  ["known-set-abbrs"],
  { revalidate: 3600 }
)

export const getManualAddOptions = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data: setRows } = await supabase.from("distinct_set_names").select("set_name")
    const { data: rarityRows } = await supabase.from("distinct_rarities").select("rarity")
    return {
      setNames: (setRows || []).map((r) => r.set_name),
      rarities: (rarityRows || []).map((r) => r.rarity),
    }
  },
  ["manual-add-options"],
  { revalidate: 3600 }
)

export async function getCardConditionPrice(cardId, variant, condition) {
  const supabase = await createClient()
  const { data: card } = await supabase
    .from("cards")
    .select("raw_skus, region, tcgplayer_market_price, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil")
    .eq("id", cardId)
    .single()

  if (!card) return null

  function getVariantPrice() {
    switch (variant) {
      case "Normal": return card.price_normal
      case "Holofoil": return card.price_holofoil
      case "Reverse Holofoil": return card.price_reverse_holofoil
      case "1st Edition Holofoil": return card.price_1st_edition_holofoil
      default: return card.tcgplayer_market_price
    }
  }

  if (!card.raw_skus) return getVariantPrice()

  const wantLang = card.region === "JP" ? "JP" : "EN"
  const rows = Object.values(card.raw_skus)
  const matches = rows.filter((r) => r.var === variant && r.cnd === condition)
  const best = matches.find((r) => r.lng === wantLang) || matches[0]
  return best?.mkt ?? getVariantPrice()
}

export async function moveItemToCollection(formData) {
  const supabase = await createClient()
  const id = formData.get("id")
  const itemType = formData.get("item_type")
  const targetCollectionId = formData.get("target_collection_id")
  const table = itemType === "sealed" ? "user_sealed_items" : "user_cards"

  const { error } = await supabase.from(table).update({ collection_id: targetCollectionId }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/collection")
}

export async function getSyncStatus() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("sync_state")
    .select("id, last_run_at")
    .in("id", ["cards_sync_tcg", "sealed_sync_tcg"])

  const cardsRow = data?.find((r) => r.id === "cards_sync_tcg")
  const sealedRow = data?.find((r) => r.id === "sealed_sync_tcg")

  return {
    cardsLastRun: cardsRow?.last_run_at || null,
    sealedLastRun: sealedRow?.last_run_at || null,
  }
}

const HISTORY_VARIANT_ORDER = [
  "Holofoil",
  "Normal",
  "Reverse Holofoil",
  "1st Edition Holofoil",
  "Standard",
]

export async function getCardPriceHistory(cardId, variant, range) {
  const supabase = await createClient()
  if (!cardId) return []

  const fromDate = new Date()
  if (range === "week") fromDate.setDate(fromDate.getDate() - 7)
  else if (range === "month") fromDate.setMonth(fromDate.getMonth() - 1)
  else fromDate.setFullYear(fromDate.getFullYear() - 1)
  const cutoff = fromDate.toISOString().slice(0, 10)

  async function rowsFor(v) {
    const { data, error } = await supabase
      .from("card_price_history")
      .select("price, recorded_at")
      .eq("card_id", cardId)
      .eq("variant", v)
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true })
    if (error) {
      console.error("[getCardPriceHistory]", v, error.message)
      return null
    }
    return data || []
  }

  let rows = variant ? await rowsFor(variant) : []

  if (!rows || rows.length === 0) {
    const { data: avail } = await supabase
      .from("card_price_history")
      .select("variant")
      .eq("card_id", cardId)
      .gte("recorded_at", cutoff)

    const present = new Set((avail || []).map((r) => r.variant))
    const pick =
      HISTORY_VARIANT_ORDER.find((v) => present.has(v)) || Array.from(present)[0]

    console.log("[getCardPriceHistory] fallback", {
      cardId,
      requested: variant,
      available: Array.from(present),
      picked: pick,
    })

    if (pick) rows = await rowsFor(pick)
  }

  return rows || []
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

export async function scanCardImage(base64Data) {
  const API_KEY = process.env.GOOGLE_VISION_API_KEY
  const rawBuffer = Buffer.from(base64Data, "base64")

  let normalizedBuffer
  let normalizedBase64
  try {
    const image = await Jimp.read(rawBuffer)
    const maxDim = 1200
    if (image.bitmap.width > maxDim || image.bitmap.height > maxDim) {
      if (image.bitmap.width > image.bitmap.height) {
        image.resize({ w: maxDim })
      } else {
        image.resize({ h: maxDim })
      }
    }
    normalizedBuffer = await image.getBuffer("image/jpeg")
    normalizedBase64 = normalizedBuffer.toString("base64")
  } catch {
    normalizedBuffer = rawBuffer
    normalizedBase64 = base64Data
  }

  const [visionResult, visualMatchesResult] = await Promise.all([
    fetch("https://vision.googleapis.com/v1/images:annotate?key=" + API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: normalizedBase64 },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    }).then((r) => r.json()),
    getVisualMatches(normalizedBuffer),
  ])

  const visionData = visionResult

  const annotations = visionData.responses && visionData.responses[0] ? visionData.responses[0].textAnnotations : null
  if (!annotations || annotations.length === 0) {
    return { name: null, cardNumber: null, candidates: [] }
  }

  const words = annotations.slice(1)

  const numberPattern = /^([A-Z]{0,3}\d+)\/([A-Z]{0,3}\d+)$/
  let cardNumber = null
  let cardNumberFull = null
  for (let i = 0; i < words.length; i++) {
    const match = words[i].description.match(numberPattern)
    if (match) {
      cardNumber = match[1]
      cardNumberFull = match[0]
      break
    }
  }

  const STAGE_WORDS = { BASIC: true, STAGE: true, "たね": true, HP: true }

  const allY = words.map(function (w) {
    return w.boundingPoly && w.boundingPoly.vertices && w.boundingPoly.vertices[0] ? w.boundingPoly.vertices[0].y || 0 : 0
  })
  const minY = Math.min.apply(null, allY)
  const maxY = Math.max.apply(null, allY)
  const topThird = minY + (maxY - minY) * 0.35

  const nameBandCandidates = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const verts = (word.boundingPoly && word.boundingPoly.vertices) || []
    const y = verts[0] ? (verts[0].y || Infinity) : Infinity
    if (y > topThird) continue
    if (word.description.length < 2) continue
    if (STAGE_WORDS[word.description.toUpperCase()]) continue
    if (/\d/.test(word.description)) continue

    const ys = verts.map(function (v) { return v.y || 0 })
    const height = Math.max.apply(null, ys) - Math.min.apply(null, ys)
    const x = verts[0] ? (verts[0].x || 0) : 0
    nameBandCandidates.push({ word: word.description, y: y, x: x, height: height })
  }

  let bestWord = null
  let bestHeight = 0
  for (const c of nameBandCandidates) {
    if (c.height > bestHeight) {
      bestHeight = c.height
      bestWord = c
    }
  }

  let name = bestWord ? bestWord.word : null
  if (bestWord) {
    const lineTolerance = bestWord.height * 0.7
    const sameLineWords = nameBandCandidates
      .filter(function (c) { return Math.abs(c.y - bestWord.y) <= lineTolerance })
      .sort(function (a, b) { return a.x - b.x })
    if (sameLineWords.length > 1) {
      name = sameLineWords.map(function (c) { return c.word }).join(" ")
    }
  }

  if (!name) {
    return { name: null, cardNumber: cardNumber, candidates: [] }
  }

  function isLikelyNonLatin(str) {
    return !!str && /[^\x00-\x7F]/.test(str)
  }

  function normalizeNumber(str) {
    if (!str) return null
    const match = String(str).match(/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  let candidates = []
  if (name && !isLikelyNonLatin(name)) {
    const searchQuery = cardNumber ? name + " " + cardNumber : name
    const searchResult = await searchCards(searchQuery, "name", 1, 6)
    candidates = searchResult.results || []
  }

  const seenIds = new Set(candidates.map((c) => c.id))
  for (const match of visualMatchesResult) {
    if (!seenIds.has(match.id) && candidates.length < 10) {
      candidates.push(match)
      seenIds.add(match.id)
    }
  }

  const targetNum = normalizeNumber(cardNumber)
  const nameLower = (name || "").toLowerCase().trim()

  const bottomThird = maxY - (maxY - minY) * 0.25
  const knownAbbrs = await getKnownSetAbbrs()
  let detectedSetAbbr = null

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const verts = (word.boundingPoly && word.boundingPoly.vertices) || []
    const y = verts[0] ? (verts[0].y || 0) : 0
    if (y < bottomThird) continue

    const text = word.description.toUpperCase()
    if (text.length < 2 || text.length > 5) continue
    if (!/^[A-Z0-9]+$/.test(text)) continue
    if (text === "EN" || text === "JP") continue

    if (knownAbbrs[text]) {
      detectedSetAbbr = text
      break
    }
  }
  const detectedNonLatin = isLikelyNonLatin(name)

  let effectiveVisualMatches = visualMatchesResult
  if (detectedNonLatin && visualMatchesResult.length === 0) {
    effectiveVisualMatches = await getVisualMatches(normalizedBuffer, 22)
  }
  const visualIds = new Set(effectiveVisualMatches.map((c) => c.id))

  const scored = candidates.map((c) => {
    let score = 0
    if (targetNum != null && normalizeNumber(c.card_number) === targetNum) score += 100
    if (c.name && c.name.toLowerCase().trim() === nameLower) score += 20
    else if (c.name && nameLower && c.name.toLowerCase().includes(nameLower)) score += 5
    if (visualIds.has(c.id)) score += 10
    if (detectedSetAbbr && c.set_abbr && c.set_abbr.toUpperCase() === detectedSetAbbr) score += 50
    if (detectedNonLatin && c.region === "JP") score += 30
    if (!detectedNonLatin && c.region === "US") score += 15
    return { card: c, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return {
    name: name,
    cardNumber: cardNumberFull || cardNumber,
    candidates: scored.map((s) => s.card),
    detectedNonLatin: detectedNonLatin,
  }
}

function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return Infinity
  let distance = 0
  for (let i = 0; i < hashA.length; i++) {
    let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16)
    while (xor) {
      distance += xor & 1
      xor >>= 1
    }
  }
  return distance
}

async function computeScanHash(buffer) {
  const image = await Jimp.read(buffer)
  image.resize({ w: 9, h: 8 })
  image.greyscale()

  let bits = ""
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = intToRGBA(image.getPixelColor(x, y)).r
      const right = intToRGBA(image.getPixelColor(x + 1, y)).r
      bits += left < right ? "1" : "0"
    }
  }

  let hex = ""
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.substr(i, 4), 2).toString(16)
  }
  return hex
}

export async function getVisualMatches(buffer) {
  let scanHash
  try {
    scanHash = await computeScanHash(buffer)
  } catch {
    return []
  }

  const supabase = await createClient()
  const { data: allHashes } = await supabase
    .from("cards")
    .select("id, image_phash")
    .not("image_phash", "is", null)

  if (!allHashes || allHashes.length === 0) return []

  const DISTANCE_THRESHOLD = 12

  const scored = allHashes
    .map((c) => ({ id: c.id, distance: hammingDistance(scanHash, c.image_phash) }))
    .filter((c) => c.distance <= DISTANCE_THRESHOLD)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)

  const topIds = scored.map((s) => s.id)

  const { data: fullCards } = await supabase
    .from("cards")
    .select("id, name, set_name, card_number, set_total, release_year, rarity, image_small, tcgplayer_market_price, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil, raw_skus, region")
    .in("id", topIds)

  const byId = {}
  for (const c of fullCards || []) byId[c.id] = c

  return scored.map((s) => byId[s.id]).filter(Boolean)
}

export async function createQuoteSession() {
  const supabase = await createClient()
  const id = Array.from({ length: 10 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("")

  const { error } = await supabase.from("quote_sessions").insert({ id })
  if (error) throw new Error(error.message)
  return id
}

export async function getQuoteSession(quoteId) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("quote_sessions")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle()
  return data
}

export async function addItemToQuote(formData) {
  const supabase = await createClient()
  const quoteSessionId = formData.get("quote_session_id")
  const cardId = formData.get("card_id")
  const variant = formData.get("variant") || "Standard"
  const condition = formData.get("condition") || "NM"
  const isGraded = formData.get("is_graded") === "yes"
  const gradeValue = isGraded ? formData.get("grade_value") || null : null
  const quantity = Number(formData.get("quantity")) || 1

  const { error } = await supabase.from("quote_items").insert({
    quote_session_id: quoteSessionId,
    card_id: cardId,
    variant,
    condition,
    is_graded: isGraded,
    grade_value: gradeValue,
    quantity,
  })
  if (error) throw new Error(error.message)
}

export async function getQuoteItems(quoteId) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("quote_items")
    .select(
      "id, variant, condition, is_graded, grade_value, quantity, created_at, cards(id, name, set_name, card_number, set_total, rarity, image_small, region, tcgplayer_market_price, price_normal, price_holofoil, price_reverse_holofoil, price_1st_edition_holofoil, raw_skus)"
    )
    .eq("quote_session_id", quoteId)
    .order("created_at", { ascending: true })
  return data || []
}

export async function removeQuoteItem(itemId) {
  const supabase = await createClient()
  const { error } = await supabase.from("quote_items").delete().eq("id", itemId)
  if (error) throw new Error(error.message)
}

export async function claimQuoteSession(quoteId, targetCollectionId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const items = await getQuoteItems(quoteId)

  for (const item of items) {
    if (!item.cards) continue
    await supabase.from("user_cards").insert({
      user_id: user.id,
      card_id: item.cards.id,
      quantity: item.quantity,
      condition: item.condition,
      variant: item.variant,
      is_graded: item.is_graded,
      grade_value: item.grade_value,
      collection_id: targetCollectionId,
    })
  }

  await supabase
    .from("quote_sessions")
    .update({ claimed: true, claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", quoteId)

  revalidatePath("/collection")
}

export async function importQuoteAsCollection(quoteId, collectionName, items) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: newCollection, error: colError } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: collectionName })
    .select()
    .single()
  if (colError) throw new Error(colError.message)

  for (const item of items) {
    const { error } = await supabase.from("user_cards").insert({
      user_id: user.id,
      card_id: item.cardId,
      quantity: item.quantity,
      condition: item.isGraded ? "NM" : item.condition,
      variant: item.variant,
      is_graded: item.isGraded,
      grade_value: item.isGraded ? item.gradeValue : null,
      collection_id: newCollection.id,
    })
    if (error) throw new Error(error.message)
  }

  await supabase
    .from("quote_sessions")
    .update({ claimed: true, claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", quoteId)

  revalidatePath("/collection")
  return newCollection.id
}

export async function incrementQuoteItemQuantity(itemId, newQuantity) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("quote_items")
    .update({ quantity: newQuantity })
    .eq("id", itemId)
  if (error) throw new Error(error.message)
}

export async function quickScanCard(base64Data) {
  const API_KEY = process.env.GOOGLE_VISION_API_KEY

  const visionRes = await fetch(
    "https://vision.googleapis.com/v1/images:annotate?key=" + API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    }
  )
  const visionData = await visionRes.json()

  const annotations = visionData.responses && visionData.responses[0] ? visionData.responses[0].textAnnotations : null
  if (!annotations || annotations.length === 0) {
    return { success: false, reason: "no_text" }
  }

  const words = annotations.slice(1)
  const fullText = annotations[0] ? annotations[0].description : ""

  const numberPattern = /^([A-Z]{0,3}\d+)\/([A-Z]{0,3}\d+)$/
  let cardNumber = null
  let cardNumberFull = null
  for (let i = 0; i < words.length; i++) {
    const match = words[i].description.match(numberPattern)
    if (match) {
      cardNumber = match[1]
      cardNumberFull = match[0]
      break
    }
  }
  if (!cardNumberFull) {
    const looseMatch = fullText.match(/([A-Z]{0,3}\d+)\s*\/\s*([A-Z]{0,3}\d+)/)
    if (looseMatch) {
      cardNumber = looseMatch[1]
      cardNumberFull = looseMatch[1] + "/" + looseMatch[2]
    }
  }

  const STAGE_WORDS = { BASIC: true, STAGE: true, HP: true, "たね": true }

  const allY = words.map(function (w) {
    return w.boundingPoly && w.boundingPoly.vertices && w.boundingPoly.vertices[0] ? w.boundingPoly.vertices[0].y || 0 : 0
  })
  const minY = Math.min.apply(null, allY)
  const maxY = Math.max.apply(null, allY)
  const topThird = minY + (maxY - minY) * 0.35

  const nameBandCandidates = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const verts = (word.boundingPoly && word.boundingPoly.vertices) || []
    const y = verts[0] ? (verts[0].y || Infinity) : Infinity
    if (y > topThird) continue
    if (word.description.length < 2) continue
    if (STAGE_WORDS[word.description.toUpperCase()]) continue
    if (/\d/.test(word.description)) continue

    const ys = verts.map(function (v) { return v.y || 0 })
    const height = Math.max.apply(null, ys) - Math.min.apply(null, ys)
    const x = verts[0] ? (verts[0].x || 0) : 0
    nameBandCandidates.push({ word: word.description, y: y, x: x, height: height })
  }

  let bestWord = null
  let bestHeight = 0
  for (const c of nameBandCandidates) {
    if (c.height > bestHeight) {
      bestHeight = c.height
      bestWord = c
    }
  }

  let name = bestWord ? bestWord.word : null
  if (bestWord) {
    const lineTolerance = bestWord.height * 0.7
    const sameLineWords = nameBandCandidates
      .filter(function (c) { return Math.abs(c.y - bestWord.y) <= lineTolerance })
      .sort(function (a, b) { return a.x - b.x })
    if (sameLineWords.length > 1) {
      name = sameLineWords.map(function (c) { return c.word }).join(" ")
    }
  }

  if (!name || !cardNumberFull || !cardNumberFull.includes("/")) {
    return { success: false, reason: "incomplete" }
  }

  function normalizeNumber(str) {
    const match = String(str || "").match(/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }
  const numParts = cardNumberFull.split("/")
  const targetNum = normalizeNumber(numParts[0])
  const targetTotal = normalizeNumber(numParts[1])

  if (targetNum == null || targetTotal == null) {
    return { success: false, reason: "incomplete" }
  }

  const searchResult = await searchCards(name + " " + cardNumber, "name", 1, 8)
  const results = searchResult.results || []

  const exactMatch = results.find(function (c) {
    return normalizeNumber(c.card_number) === targetNum && normalizeNumber(c.set_total) === targetTotal
  })

  if (!exactMatch) {
    return { success: false, reason: "no_confident_match" }
  }

  return { success: true, card: exactMatch, name: name, cardNumber: cardNumberFull }
}