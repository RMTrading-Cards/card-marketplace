"use client"
import { useEffect, useRef, useState } from "react"
import { quickScanCard, addItemToQuote, getQuoteItems, removeQuoteItem, incrementQuoteItemQuantity } from "../../collection/actions"

const STABILITY_CHECK_MS = 150
const STABLE_FRAMES_REQUIRED = 2
const DIFF_THRESHOLD = 20
const SMALL_W = 48
const SMALL_H = 32

function getFirstVariant(card) {
  if (card.price_normal != null) return "Normal"
  if (card.price_holofoil != null) return "Holofoil"
  if (card.price_reverse_holofoil != null) return "Reverse Holofoil"
  if (card.price_1st_edition_holofoil != null) return "1st Edition Holofoil"
  return "Standard"
}

function captureFrameAsBase64(video, canvas) {
  const maxDim = 1000
  let width = video.videoWidth
  let height = video.videoHeight
  if (width > height && width > maxDim) {
    height = Math.round(height * (maxDim / width))
    width = maxDim
  } else if (height > maxDim) {
    width = Math.round(width * (maxDim / height))
    height = maxDim
  }
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(video, 0, 0, width, height)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
  return dataUrl.split(",")[1]
}

function getSmallGrayscale(video, smallCanvas) {
  smallCanvas.width = SMALL_W
  smallCanvas.height = SMALL_H
  const ctx = smallCanvas.getContext("2d")
  ctx.drawImage(video, 0, 0, SMALL_W, SMALL_H)
  const imageData = ctx.getImageData(0, 0, SMALL_W, SMALL_H)
  const data = imageData.data
  const gray = new Uint8Array(SMALL_W * SMALL_H)
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4
    gray[i] = (data[offset] + data[offset + 1] + data[offset + 2]) / 3
  }
  return gray
}

function averageDiff(a, b) {
  if (!a || !b || a.length !== b.length) return 999
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i])
  }
  return sum / a.length
}

export default function QuoteScan({ quoteId }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const smallCanvasRef = useRef(null)
  const lastKeyRef = useRef(null)
  const busyRef = useRef(false)

  const prevGrayRef = useRef(null)
  const stableCountRef = useRef(0)
  const readyToScanRef = useRef(true)

  const [cameraError, setCameraError] = useState("")
  const [autoScanning, setAutoScanning] = useState(true)
  const [stabilityHint, setStabilityHint] = useState("Point at a card")
  const [addedItems, setAddedItems] = useState([])
  const [toast, setToast] = useState("")
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    refreshItems()
  }, [])

  useEffect(() => {
    let stream = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        setCameraError("Could not access camera: " + err.message)
      }
    }

    startCamera()

    return function () {
      if (stream) stream.getTracks().forEach(function (t) { t.stop() })
    }
  }, [])

  useEffect(() => {
    if (!autoScanning) return
    const interval = setInterval(function () {
      checkStabilityTick()
    }, STABILITY_CHECK_MS)
    return function () { clearInterval(interval) }
  }, [autoScanning, addedItems])

  async function refreshItems() {
    const items = await getQuoteItems(quoteId)
    setAddedItems(items)
  }

  function checkStabilityTick() {
    if (busyRef.current) return
    const video = videoRef.current
    const smallCanvas = smallCanvasRef.current
    if (!video || !smallCanvas || video.readyState !== video.HAVE_ENOUGH_DATA) return

    const currentGray = getSmallGrayscale(video, smallCanvas)
    const diff = averageDiff(prevGrayRef.current, currentGray)
    prevGrayRef.current = currentGray

    if (diff < DIFF_THRESHOLD) {
      stableCountRef.current += 1
    } else {
      stableCountRef.current = 0
      readyToScanRef.current = true
      setStabilityHint("Hold the card steady...")
    }

    if (stableCountRef.current >= STABLE_FRAMES_REQUIRED && readyToScanRef.current) {
      readyToScanRef.current = false
      setStabilityHint("Reading...")
      runScan()
    }
  }

  async function runScan() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    busyRef.current = true
    try {
      const base64 = captureFrameAsBase64(video, canvas)
      const result = await quickScanCard(base64)

      if (!result.success) {
        setStabilityHint("Couldn't read it clearly - try repositioning")
        setToast("Make sure the card is flat, in focus, with the number visible in the bottom corner")
        setTimeout(function () { setToast("") }, 1200)
        return
      }

      const top = result.card
      const variant = getFirstVariant(top)
      const currentKey = top.id + "|" + variant

      if (currentKey === lastKeyRef.current) {
        setStabilityHint("Move to the next card")
        return
      }
      lastKeyRef.current = currentKey

      const existing = addedItems.find(function (item) {
        return item.cards && item.cards.id === top.id && item.variant === variant
      })

      if (existing) {
        const newQty = existing.quantity + 1
        await incrementQuoteItemQuantity(existing.id, newQty)
        setToast("Now have " + newQty + "x " + top.name)
      } else {
        const formData = new FormData()
        formData.set("quote_session_id", quoteId)
        formData.set("card_id", top.id)
        formData.set("variant", variant)
        formData.set("condition", "NM")
        formData.set("quantity", 1)
        formData.set("is_graded", "no")
        await addItemToQuote(formData)
        setToast("Added: " + top.name)
      }

      setStabilityHint("Move to the next card")
      await refreshItems()
      setTimeout(function () { setToast("") }, 2000)
    } catch (err) {
      setStabilityHint("Point at a card")
    } finally {
      busyRef.current = false
    }
  }

  async function handleRemove(itemId) {
    await removeQuoteItem(itemId)
    lastKeyRef.current = null
    refreshItems()
  }

  async function handleQuantityChange(itemId, newQty) {
    await incrementQuoteItemQuantity(itemId, newQty)
    refreshItems()
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : ""

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ color: "#ffffff", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
          <span style={{ color: "#F2B705" }}>RMT</span>rading Cards - Get a Quote
        </h1>
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
          Hold each card flat and steady, filling most of the frame. It's added automatically once it holds still.
        </p>

        {cameraError ? (
          <p style={{ color: "#f87171", marginBottom: 20 }}>{cameraError}</p>
        ) : (
          <div style={{ position: "relative", marginBottom: 8 }}>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 10, border: "2px solid #F2B705" }} muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <canvas ref={smallCanvasRef} style={{ display: "none" }} />

            <div style={{ position: "absolute", top: 10, left: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", color: "#F2B705", padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              {stabilityHint}
            </div>

            {toast && (
              <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "rgba(0,0,0,0.8)", color: "#F2B705", padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "center" }}>
                {toast}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={function () { setAutoScanning(!autoScanning) }}
            style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
          >
            {autoScanning ? "Pause Scanning" : "Resume Scanning"}
          </button>
          <button
            onClick={function () {
              if (!busyRef.current) {
                readyToScanRef.current = false
                setStabilityHint("Reading...")
                runScan()
              }
            }}
            style={{ backgroundColor: "#F2B705", border: "none", color: "#000", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Scan Now
          </button>
        </div>

        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 16, marginBottom: 20 }}>
          <h2 style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Cards in this quote ({addedItems.length})
          </h2>
          {addedItems.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 13 }}>No cards added yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {addedItems.map(function (item) {
                return (
                  <div key={item.id} style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a", borderRadius: 6, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      {item.cards?.image_small && (
                        <img
                          src={item.cards.image_small}
                          alt={item.cards.name}
                          style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ color: "#ffffff", fontSize: 13 }}>
                        {item.cards?.name}
                      </div>
                    </div>
                    <select
                      value={item.quantity}
                      onChange={function (e) { handleQuantityChange(item.id, Number(e.target.value)) }}
                      style={{ backgroundColor: "#0d0d0d", border: "1px solid #2a2a2a", color: "#ffffff", borderRadius: 6, padding: "4px 6px", fontSize: 15, flexShrink: 0 }}
                    >
                      {Array.from({ length: 20 }, function (_, i) { return i + 1 }).map(function (n) {
                        return <option key={n} value={n}>Qty: {n}</option>
                      })}
                    </select>
                    <button
                      onClick={function () { handleRemove(item.id) }}
                      style={{ backgroundColor: "#2a1414", color: "#f87171", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {addedItems.length > 0 && (
          <div style={{ textAlign: "center" }}>
            {!showQr ? (
              <button
                onClick={function () { setAutoScanning(false); setShowQr(true) }}
                style={{ backgroundColor: "#F2B705", color: "#000", fontWeight: 700, borderRadius: 8, padding: "12px 24px", fontSize: 15, border: "none", cursor: "pointer" }}
              >
                Done Scanning - Show My QR Code
              </button>
            ) : (
              <div style={{ backgroundColor: "#141414", border: "1px solid #F2B705", borderRadius: 10, padding: 20, display: "inline-block" }}>
                <p style={{ color: "#ffffff", fontSize: 14, marginBottom: 12 }}>Show this to us</p>
                <img
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(shareUrl)}
                  alt="QR code"
                  style={{ borderRadius: 6, backgroundColor: "#ffffff", padding: 8 }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}