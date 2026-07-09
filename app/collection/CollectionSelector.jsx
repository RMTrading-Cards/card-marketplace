"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCollection, renameCollection, deleteCollection, setMainCollection } from "./actions"

export default function CollectionSelector({ collections, selectedIds, onSelectionChange, sellingMode, onToggleSelling }) {
  const [managing, setManaging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const router = useRouter()

  const allIds = collections.map((c) => c.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))

  function toggleAll() {
    onSelectionChange(allSelected ? [collections.find((c) => c.is_main)?.id].filter(Boolean) : allIds)
  }

  function toggleOne(id) {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((x) => x !== id)
      onSelectionChange(next.length > 0 ? next : [id])
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  function pickerLabel() {
    if (allSelected) return "All Collections"
    if (selectedIds.length === 1) {
      const c = collections.find((x) => x.id === selectedIds[0])
      return c ? `${c.name}${c.is_main ? " (Main)" : ""}` : "Select Collection"
    }
    return `${selectedIds.length} Collections Selected`
  }

  async function handleCreate(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await createCollection(formData)
    setCreating(false)
    router.refresh()
  }

  async function handleRename(e, id) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("id", id)
    await renameCollection(formData)
    setRenamingId(null)
    router.refresh()
  }

  async function handleDelete(id) {
    if (!confirm("Delete this collection? Its cards will move to Main Collection.")) return
    const formData = new FormData()
    formData.set("id", id)
    await deleteCollection(formData)
    if (selectedIds.includes(id)) {
      const main = collections.find((c) => c.is_main)
      onSelectionChange([main?.id].filter(Boolean))
    }
    router.refresh()
  }

  async function handleSetMain(id) {
    const formData = new FormData()
    formData.set("id", id)
    await setMainCollection(formData)
    router.refresh()
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="rmt-tab"
            style={{
              backgroundColor: "#141414",
              border: "1px solid #2a2a2a",
              color: "#ffffff",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              cursor: "pointer",
              minWidth: 180,
              textAlign: "left",
            }}
          >
            {pickerLabel()} ▾
          </button>

          {pickerOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                zIndex: 20,
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: 8,
                padding: 12,
                minWidth: 240,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#F2B705", fontSize: 14, fontWeight: 600, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                All Collections
              </label>
              <div style={{ borderTop: "1px solid #222", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {collections.map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff", fontSize: 14, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleOne(c.id)}
                    />
                    {c.name}{c.is_main ? " (Main)" : ""}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setManaging(!managing)}
          className="rmt-tab"
          style={{
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Manage Collections
        </button>

        <button
          onClick={onToggleSelling}
          className={`rmt-tab${sellingMode ? " rmt-tab-active" : ""}`}
          style={{
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Selling
        </button>
      </div>

      {managing && (
        <div
          style={{
            marginTop: 12,
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: 16,
            maxWidth: 420,
          }}
        >
          {collections.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: "1px solid #222",
              }}
            >
              {renamingId === c.id ? (
                <form onSubmit={(e) => handleRename(e, c.id)} style={{ display: "flex", gap: 6, flex: 1 }}>
                  <input
                    name="name"
                    defaultValue={c.name}
                    autoFocus
                    style={{
                      flex: 1,
                      backgroundColor: "#0d0d0d",
                      border: "1px solid #2a2a2a",
                      color: "#ffffff",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 16,
                    }}
                  />
                  <button
                    type="submit"
                    className="rmt-btn"
                    style={{ backgroundColor: "#F2B705", color: "#000", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}
                  >
                    Save
                  </button>
                </form>
              ) : (
                <>
                  <span style={{ flex: 1, color: "#ffffff", fontSize: 14 }}>
                    {c.name}{c.is_main ? " (Main)" : ""}
                  </span>
                  <button
                    onClick={() => setRenamingId(c.id)}
                    className="rmt-tab"
                    style={{ backgroundColor: "#0d0d0d", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                  >
                    Rename
                  </button>
                  {!c.is_main && (
                    <button
                      onClick={() => handleSetMain(c.id)}
                      className="rmt-tab"
                      style={{ backgroundColor: "#0d0d0d", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                    >
                      Set Main
                    </button>
                  )}
                  {!c.is_main && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rmt-remove-btn"
                      style={{ backgroundColor: "#2a1414", color: "#f87171", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {creating ? (
            <form onSubmit={handleCreate} style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                name="name"
                placeholder="New collection name"
                autoFocus
                style={{
                  flex: 1,
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                  color: "#ffffff",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 16,
                }}
              />
              <button
                type="submit"
                className="rmt-btn"
                style={{ backgroundColor: "#F2B705", color: "#000", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}
              >
                Create
              </button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="rmt-tab"
              style={{
                width: "100%",
                marginTop: 8,
                backgroundColor: "#0d0d0d",
                border: "1px dashed #3a3a3a",
                color: "#F2B705",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              + New Collection
            </button>
          )}
        </div>
      )}
    </div>
  )
}
