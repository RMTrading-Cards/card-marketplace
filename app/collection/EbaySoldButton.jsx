"use client";

import { getEbaySoldLink } from "@/lib/ebay";

export default function EbaySoldButton({
  card,
  variant,
  condition,
  isGraded = false,
  gradeValue = null,
  style = {},
}) {
  if (!card) return null;

  return (
    <a
      href={getEbaySoldLink(card.name, card.card_number, {
        condition,
        variant,
        isGraded,
        gradeValue,
      })}
      target="_blank"
      rel="noopener noreferrer"
      className="rmt-tab"
      style={{
        backgroundColor: "#0d0d0d",
        border: "1px solid #2a2a2a",
        color: "#F2B705",
        borderRadius: 6,
        padding: "3px 8px",
        fontSize: 11,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        ...style,
      }}
    >
      🛒 Sold on eBay
    </a>
  );
}