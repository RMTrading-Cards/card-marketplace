"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { updateUsername } from "./actions"

export default function ProfileMenu({ email, username }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function handleUsernameSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await updateUsername(formData)
    setEditing(false)
    router.refresh()
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="rmt-btn"
        style={{
          backgroundColor: "#141414",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {username || email}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: 16,
            minWidth: 220,
            zIndex: 20,
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Signed in as</div>
          <div style={{ color: "#ffffff", fontSize: 14, marginBottom: 12, wordBreak: "break-all" }}>
            {email}
          </div>

          {editing ? (
            <form onSubmit={handleUsernameSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <input
                name="username"
                defaultValue={username || ""}
                placeholder="Choose a username"
                autoFocus
                style={{
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                  color: "#ffffff",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 16,
                }}
              />
              <button
                type="submit"
                className="rmt-btn"
                style={{
                  backgroundColor: "#F2B705",
                  color: "#000000",
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="rmt-tab"
              style={{
                width: "100%",
                backgroundColor: "#0d0d0d",
                border: "1px solid #2a2a2a",
                color: "#ffffff",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 14,
                cursor: "pointer",
                marginBottom: 12,
              }}
            >
              {username ? "Change username" : "Set username"}
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="rmt-remove-btn"
            style={{
              width: "100%",
              backgroundColor: "#2a1414",
              color: "#f87171",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
