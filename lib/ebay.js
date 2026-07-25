function doubleEncode(str) {
  return encodeURIComponent(encodeURIComponent(str))
}

const CONDITION_KEYWORD = {
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
}

export function getEbaySoldLink(name, cardNumber, opts = {}) {
  const condition = opts.condition
  const variant = opts.variant
  const isGraded = opts.isGraded
  const gradeValue = opts.gradeValue

  let keyword = name || ""
  if (cardNumber) keyword += " " + cardNumber

  if (isGraded) {
    if (gradeValue) keyword += " " + gradeValue
  } else {
    keyword += " -PSA -BGS -CGC -SGC -graded"
    if (condition && condition !== "NM" && CONDITION_KEYWORD[condition]) {
      keyword += " " + CONDITION_KEYWORD[condition]
    }
  }

  if (variant === "1st Edition Holofoil") {
    keyword += " 1st Edition"
  } else if (variant === "Reverse Holofoil") {
    keyword += " Reverse Holo"
  }

  const params = new URLSearchParams()
  params.set("_nkw", keyword.trim())
  params.set("LH_Sold", "1")
  params.set("LH_Complete", "1")

  let url = "https://www.ebay.com/sch/i.html?" + params.toString()

  if (!isGraded && condition === "NM") {
    url += "&Card" + doubleEncode(" ") + "Condition=" + doubleEncode("Near Mint or Better")
  }
  if (!isGraded && variant === "1st Edition Holofoil") {
    url += "&Features=" + doubleEncode("1st Edition")
  }

  url += "&_dcat=183454"

  return url
}