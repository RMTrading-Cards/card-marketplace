export function getVariantPrice(card, variant) {
  if (!card) return null
  switch (variant) {
    case "Normal": return card.price_normal
    case "Holofoil": return card.price_holofoil
    case "Reverse Holofoil": return card.price_reverse_holofoil
    case "1st Edition Holofoil": return card.price_1st_edition_holofoil
    default: return card.tcgplayer_market_price
  }
}

export function getConditionPriceRange(card, variant, condition) {
  const marketFallback = getVariantPrice(card, variant)
  if (!card || !card.raw_skus) {
    return { low: null, market: marketFallback, high: null }
  }

  const wantLang = card.region === "JP" ? "JP" : "EN"
  const rows = Object.values(card.raw_skus)
  const matches = rows.filter(function (r) { return r.var === variant && r.cnd === condition })
  const best = matches.find(function (r) { return r.lng === wantLang }) || matches[0]

  if (!best) {
    return { low: null, market: marketFallback, high: null }
  }

  return {
    low: best.low != null ? best.low : null,
    market: best.mkt != null ? best.mkt : marketFallback,
    high: best.hi != null ? best.hi : null,
  }
}