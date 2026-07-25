export function getEbaySoldLink(name, cardNumber) {
  const query = cardNumber ? `${name} ${cardNumber}` : name
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
  })
  return `https://www.ebay.com/sch/i.html?${params.toString()}`
}