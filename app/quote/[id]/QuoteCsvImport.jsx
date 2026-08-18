"use client"
import { useState, useRef } from "react"
import Papa from "papaparse"
import { importCsvRowsToQuote } from "../../collection/actions"

function cleanCardName(rawName) {
  let name = (rawName || "").trim()
  const isJP = /\(JP\)\s*$/i.test(name)

  let prev
  do {
    prev = name
    name = name.replace(/\s*\([^)]*\)\s*$/, "").trim()
  } while (name !== prev)

  name = name.replace(/\s*-\s*\d+(\/[A-Za-z0-9-]+)?\s*$/, "").trim()

  const basicEnergyTypes = ["Lightning", "Fire", "Water", "Grass", "Psychic", "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless"]
  const matchesBasicEnergy = basicEnergyTypes.some(function (type) {
    return name.toLowerCase() === (type + " Energy").toLowerCase()
  })
  if (matchesBasicEnergy) {
    name = "Basic " + name
  }

  return { name, isJP }
}

function findHeader(headers, candidates) {
  const lowerHeaders = headers.map(function (h) { return h.toLowerCase().trim() })
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate.toLowerCase())
    if (idx !== -1) return headers[idx]
  }
  return null
}

export default function QuoteCsvImport(props) {
  const quoteId = props.quoteId
  const onImported = props.onImported
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")
  const fileInputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return

    setError("")
    setResults(null)
    setImporting(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (parsed) {
        try {
          const headers = parsed.meta.fields || []

          const categoryHeader = findHeader(headers, ["Category", "Game", "TCG"])
          const nameHeader = findHeader(headers, ["Product Name", "Card Name", "Name", "Card"])
          const setHeader = findHeader(headers, ["Set", "Set Name", "Expansion"])
          const numberHeader = findHeader(headers, ["Card Number", "Number", "Collector Number", "#"])
          const conditionHeader = findHeader(headers, ["Card Condition", "Condition"])
          const rarityHeader = findHeader(headers, ["Rarity"])
          const variantHeader = findHeader(headers, ["Variance", "Variant", "Printing", "Finish"])
          const gradeHeader = findHeader(headers, ["Grade", "Grading"])
          const quantityHeader = findHeader(headers, ["Quantity", "Qty"])

          if (!nameHeader) {
            setError("Could not find a card name column in this CSV. Please check the file format.")
            setImporting(false)
            return
          }

          const SEALED_KEYWORDS = ["box", "collection", "tin", "pack", "bundle", "case", "etb", "elite trainer", "blister", "display", "deck"]

          const rows = parsed.data
            .filter(function (r) {
              if (!categoryHeader) return true
              const cat = (r[categoryHeader] || "").toLowerCase().trim()
              return cat === "pokemon" || cat === "pokémon" || cat === ""
            })
            .filter(function (r) {
              const nameLower = (r[nameHeader] || "").toLowerCase()
              return !SEALED_KEYWORDS.some(function (kw) { return nameLower.indexOf(kw) !== -1 })
            })
            .map(function (r) {
              const cleaned = cleanCardName(r[nameHeader])
              return {
                name: cleaned.name,
                regionHint: cleaned.isJP ? "JP" : null,
                setName: setHeader ? (r[setHeader] || "").trim() : null,
                cardNumber: numberHeader ? (r[numberHeader] || "").trim() : null,
                condition: conditionHeader ? r[conditionHeader] : null,
                rarity: rarityHeader ? r[rarityHeader] : null,
                variant: variantHeader ? r[variantHeader] : null,
                grade: gradeHeader ? r[gradeHeader] : null,
                quantity: quantityHeader ? r[quantityHeader] : 1,
              }
            })
            .filter(function (r) { return r.name && r.name.trim() })

          if (rows.length === 0) {
            setError("No Pokemon cards found in this file after filtering.")
            setImporting(false)
            return
          }

          const importResults = await importCsvRowsToQuote(quoteId, rows)
          setResults(importResults)
        } catch (err) {
          setError(err.message || "Something went wrong reading this file")
        } finally {
          setImporting(false)
        }
      },
      error: function (err) {
        setError("Could not parse CSV: " + err.message)
        setImporting(false)
      },
    })
  }

  const matchedCount = results ? results.filter(function (r) { return r.matched }).length : 0
  const unmatchedCount = results ? results.length - matchedCount : 0

  return (
    <div>
      <h2 style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        Import from CSV
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
        Upload a Collectr (or similar) export. We'll only import rows marked as Pokemon.
      </p>

      <label
        style={{
          display: "block",
          backgroundColor: "#141414",
          border: "2px dashed #3a3a3a",
          borderRadius: 10,
          padding: "30px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        <div style={{ color: "#F2B705", fontSize: 15, fontWeight: 600 }}>
          {importing ? "Importing..." : "Tap to Choose CSV File"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={importing}
          style={{ display: "none" }}
        />
      </label>

      {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {results && (
        <div>
          <p style={{ color: "#ffffff", fontSize: 14, marginBottom: 8 }}>
            Matched {matchedCount} card(s){unmatchedCount > 0 ? ", " + unmatchedCount + " could not be matched" : ""}.
          </p>
          {unmatchedCount > 0 && (
            <div style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, marginBottom: 12, maxHeight: 300, overflowY: "auto" }}>
              {results.filter(function (r) { return !r.matched }).map(function (r, i) {
                const details = [r.row.setName, r.row.cardNumber].filter(Boolean).join(" ")
                return (
                  <div key={i} style={{ marginBottom: 10, borderBottom: "1px solid #2a2a2a", paddingBottom: 8 }}>
                    <div style={{ color: "#f87171", fontSize: 12 }}>
                      {r.row.name}{details ? " (" + details + ")" : ""} - {r.reason}
                    </div>
                    {r.debugQuery && (
                      <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 2 }}>
                        Query: "{r.debugQuery}" — {r.debugCandidates.length} candidate(s) found
                        {r.debugCandidates.length > 0 && (
                          <div style={{ marginLeft: 8 }}>
                            {r.debugCandidates.map(function (c, ci) {
                              return <div key={ci}>{c}</div>
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <button
            onClick={onImported}
            style={{ backgroundColor: "#F2B705", color: "#000", fontWeight: 700, borderRadius: 8, padding: "10px 20px", fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}