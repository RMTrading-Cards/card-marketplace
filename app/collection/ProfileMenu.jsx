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
  const [cardsProgress, setCardsProgress] = useState(0)
  const [sealedProgress, setSealedProgress] = useState(0)
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

  async function handleFullSyncCards() {
    setRefreshingCards(true)
    setRefreshResult("Starting full cards sync...")
    setCardsProgress(0)
    let totalSynced = 0
    let iterations = 0
    const maxIterations = 40

    try {
      while (iterations < maxIterations) {
        const result = await refreshCardsData()
        iterations++
        totalSynced += result.cardsSynced ?? 0
        const totalSets = result.totalSets || 732
        const pct = Math.round((result.nextIndex / totalSets) * 100)
        setCardsProgress(pct)
        setRefreshResult(`Synced ${totalSynced} cards so far — batch ${iterations}, position ${result.nextIndex}/${totalSets}`)

        if (result.nextIndex === 0) break
      }
      setCardsProgress(100)
      setRefreshResult(`Full cards sync complete — ${totalSynced} cards processed across ${iterations} batch(es). Reloading...`)
      const status = await getSyncStatus()
      setSyncStatus(status)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setRefreshResult(`Error: ${err.message}`)
      setRefreshingCards(false)
    }
  }

  async function handleFullSyncSealed() {
    setRefreshingSealed(true)
    setRefreshResult("Starting full sealed sync...")
    setSealedProgress(0)
    let totalSynced = 0
    let iterations = 0
    const maxIterations = 40

    try {
      while (iterations < maxIterations) {
        const result = await refreshSealedData()
        iterations++
        totalSynced += result.productsSynced ?? 0
        const totalSets = result.totalSets || 732
        const pct = Math.round((result.nextIndex / totalSets) * 100)
        setSealedProgress(pct)
        setRefreshResult(`Synced ${totalSynced} sealed products so far — batch ${iterations}, position ${result.nextIndex}/${totalSets}`)

        if (result.nextIndex === 0) break
      }
      setSealedProgress(100)
      setRefreshResult(`Full sealed sync complete — ${totalSynced} products processed across ${iterations} batch(es). Reloading...`)
      const status = await getSyncStatus()
      setSyncStatus(status)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setRefreshResult(`Error: ${err.message}`)
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
            minWidth: 300,
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
                Admin: run a full sync now (daily auto-sync still runs regardless)
              </div>

              <button
                onClick={handleFullSyncCards}
                disabled={refreshingCards || refreshingSealed}
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
                  marginBottom: 6,
                  opacity: refreshingCards || refreshingSealed ? 0.7 : 1,
                }}
              >
                {refreshingCards ? `Syncing Cards... ${cardsProgress}%` : "Full Sync: Cards"}
              </button>
              {refreshingCards && (
                <div style={{ backgroundColor: "#0d0d0d", borderRadius: 4, height: 6, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ width: `${cardsProgress}%`, backgroundColor: "#16a34a", height: "100%", transition: "width 0.3s" }} />
                </div>
              )}

              <button
                onClick={handleFullSyncSealed}
                disabled={refreshingCards || refreshingSealed}
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
                  marginBottom: 6,
                  opacity: refreshingCards || refreshingSealed ? 0.7 : 1,
                }}
              >
                {refreshingSealed ? `Syncing Sealed... ${sealedProgress}%` : "Full Sync: Sealed"}
              </button>
              {refreshingSealed && (
                <div style={{ backgroundColor: "#0d0d0d", borderRadius: 4, height: 6, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ width: `${sealedProgress}%`, backgroundColor: "#16a34a", height: "100%", transition: "width 0.3s" }} />
                </div>
              )}

              {refreshResult && (
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 4, wordBreak: "break-word" }}>
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