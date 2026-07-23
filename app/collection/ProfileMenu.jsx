"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { updateUsername, refreshCardsData, refreshSealedData, getSyncStatus } from "./actions"

function formatSyncTime(iso) {
  if (!iso) return "Never"
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return `${yyyy}:${mm}:${dd} at ${time}`
}

export default function ProfileMenu({ email, username, isAdmin }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [refreshingCards, setRefreshingCards] = useState(false)
  const [refreshingSealed, setRefreshingSealed] = useState(false)
  const [refreshResult, setRefreshResult] = useState("")
  const [syncStatus, setSyncStatus] = useState(null)
  const router = useRouter()

  useEffect(() => {
    if (open && !syncStatus) {
      getSyncStatus().then(setSyncStatus)
    }
  }, [open, syncStatus])

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

  async function handleRefreshCards() {
    setRefreshingCards(true)
    setRefreshResult("")
    try {
      const result = await refreshCardsData()
      setRefreshResult(`Cards: synced ${result.cardsSynced ?? 0} (${result.nextIndex}/${result.totalSets} sets)`)
      const status = await getSyncStatus()
      setSyncStatus(status)
      router.refresh()
    } catch (err) {
      setRefreshResult(`Error: ${err.message}`)
    } finally {
      setRefreshingCards(false)
    }
  }

  async function handleRefreshSealed() {
    setRefreshingSealed(true)
    setRefreshResult("")
    try {
      const result = await refreshSealedData()
      setRefreshResult(`Sealed: synced ${result.productsSynced ?? 0} (${result.nextIndex}/${result.totalSets} sets)`)
      const status = await getSyncStatus()
      setSyncStatus(status)
      router.refresh()
    } catch (err) {
      setRefreshResult(`Error: ${err.message}`)
    } finally {
      setRefreshingSealed(false)
    }
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
            minWidth: 280,
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

          {isAdmin && (
            <div style={{ marginBottom: 12, paddingTop: 12, borderTop: "1px solid #2a2a2a" }}>
              <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>
                Admin: force a data refresh (daily auto-sync still runs regardless)
              </div>
              <button
                onClick={handleRefreshCards}
                disabled={refreshingCards}
                style={{
                  width: "100%",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 13,
                  border: "none",
                  cursor: refreshingCards ? "default" : "pointer",
                  marginBottom: 8,
                  opacity: refreshingCards ? 0.7 : 1,
                }}
              >
                {refreshingCards ? "Refreshing Cards..." : "Refresh Cards Data"}
              </button>
              <button
                onClick={handleRefreshSealed}
                disabled={refreshingSealed}
                style={{
                  width: "100%",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 13,
                  border: "none",
                  cursor: refreshingSealed ? "default" : "pointer",
                  opacity: refreshingSealed ? 0.7 : 1,
                }}
              >
                {refreshingSealed ? "Refreshing Sealed..." : "Refresh Sealed Data"}
              </button>
              {refreshResult && (
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 8, wordBreak: "break-word" }}>
                  {refreshResult}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12, paddingTop: 12, borderTop: "1px solid #2a2a2a" }}>
            <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 6 }}>Last data sync</div>
            {syncStatus ? (
              <>
                <div style={{ color: "#ffffff", fontSize: 12, marginBottom: 2 }}>
                  Cards: {formatSyncTime(syncStatus.cardsLastRun)}
                </div>
                <div style={{ color: "#ffffff", fontSize: 12 }}>
                  Sealed: {formatSyncTime(syncStatus.sealedLastRun)}
                </div>
              </>
            ) : (
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Loading...</div>
            )}
          </div>

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