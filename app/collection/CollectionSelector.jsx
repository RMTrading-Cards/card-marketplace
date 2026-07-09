"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCollection, renameCollection, deleteCollection, setMainCollection } from "./actions"

export default function CollectionSelector({ collections, selectedId, onSelect, sellingMode, onToggleSelling }) {
  const [managing, setManaging] = useState(false)
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const router = useRouter()

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
    if (selectedId === id) {
      const main = collections.find((c) => c.is_main)
      onSelect(main?.id)
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
        <select
          value={selectedId || ""}
          onChange={(e) => onSelect(e.target.value)}
          style={{
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 16,
          }}
        >
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.is_main ? " (Main)" : ""}
            </option>
          ))}
        </select>

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
