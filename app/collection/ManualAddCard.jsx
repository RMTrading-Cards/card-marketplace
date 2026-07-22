"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { addManualCard } from "./actions"

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid #2a2a2a",
  color: "#ffffff",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 16,
  boxSizing: "border-box",
}
const labelStyle = { color: "#9ca3af", fontSize: 12, marginBottom: 4, display: "block" }
const fieldWrap = { marginBottom: 12 }

export default function ManualAddCard({ collectionId, onAdded, manualAddOptions }) {
  const setNames = manualAddOptions?.setNames || []
  const rarities = manualAddOptions?.rarities || []
  const router = useRouter()
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isGraded, setIsGraded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    const formEl = e.currentTarget
    const formData = new FormData(formEl)

    try {
      let imageUrl = ""

      if (imageFile) {
        const supabase = createClient()
        const ext = imageFile.name.split(".").pop()
        const path = `manual/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from("card-images")
          .upload(path, imageFile)

        if (uploadError) throw new Error(uploadError.message)

        const { data: publicUrlData } = supabase.storage
          .from("card-images")
          .getPublicUrl(path)

        imageUrl = publicUrlData.publicUrl
      }

      formData.set("image_url", imageUrl)
      formData.set("collection_id", collectionId || "")
      formData.set("is_graded", isGraded ? "yes" : "no")

      await addManualCard(formData)
      router.refresh()
      formEl.reset()
      setImageFile(null)
      setImagePreview(null)
      setIsGraded(false)
      onAdded()
    } catch (err) {
      setError(err.message || "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Manually Add a Card
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
        Use this for cards not in our database — graded cards, oddball promos, or anything you want to track manually.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Photo</label>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" style={{ width: 160, borderRadius: 6, marginBottom: 8, display: "block" }} />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ color: "#ffffff", fontSize: 14 }}
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Card Name *</label>
          <input name="name" required placeholder="e.g. Charizard ex" style={inputStyle} />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Set / Type</label>
          <input
            name="set_name"
            list="set-name-options"
            placeholder="Type or pick a set..."
            style={inputStyle}
          />
          <datalist id="set-name-options">
            {setNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Rarity</label>
          <select name="rarity" defaultValue="" style={inputStyle}>
            <option value="" disabled>Select a rarity...</option>
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Graded?</label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ color: "#ffffff", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={!isGraded} onChange={() => setIsGraded(false)} />
              No
            </label>
            <label style={{ color: "#ffffff", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={isGraded} onChange={() => setIsGraded(true)} />
              Yes
            </label>
          </div>
        </div>

        {isGraded ? (
          <div style={fieldWrap}>
            <label style={labelStyle}>Grade (e.g. PSA 10, BGS 9.5)</label>
            <input name="grade_value" placeholder="PSA 10" style={inputStyle} />
          </div>
        ) : (
          <div style={fieldWrap}>
            <label style={labelStyle}>Condition</label>
            <select name="condition" defaultValue="NM" style={inputStyle}>
              <option value="NM">Near Mint</option>
              <option value="LP">Lightly Played</option>
              <option value="MP">Moderately Played</option>
              <option value="HP">Heavily Played</option>
              <option value="DMG">Damaged</option>
            </select>
          </div>
        )}

        <div style={fieldWrap}>
          <label style={labelStyle}>Quantity</label>
          <select name="quantity" defaultValue={1} style={inputStyle}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Qty: {n}</option>
            ))}
          </select>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Your Purchase Price</label>
          <input name="purchase_price" type="number" step="0.01" placeholder="0.00" style={inputStyle} />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Market Price (optional, your own estimate)</label>
          <input name="market_price" type="number" step="0.01" placeholder="0.00" style={inputStyle} />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Ask Price (shown on your public share link)</label>
          <input name="ask_price" type="number" step="0.01" placeholder="0.00" style={inputStyle} />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rmt-btn"
          style={{
            width: "100%",
            backgroundColor: "#F2B705",
            color: "#000000",
            fontWeight: 600,
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            border: "none",
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Adding..." : "Add to Collection"}
        </button>
      </form>
    </div>
  )
}