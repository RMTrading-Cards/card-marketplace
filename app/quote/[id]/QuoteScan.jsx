"use client"

import { useEffect, useRef, useState } from "react"
import {
  scanCardImage,
  addItemToQuote,
  getQuoteItems,
  removeQuoteItem,
  incrementQuoteItemQuantity
} from "../../collection/actions"

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

export default function QuoteScan({ quoteId }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const lastKeyRef = useRef(null)
  const busyRef = useRef(false)

  const [cameraError, setCameraError] = useState("")
  const [autoScanning, setAutoScanning] = useState(true)
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment"
          }
        })

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
      if (stream) {
        stream.getTracks().forEach(function (t) {
          t.stop()
        })
      }
    }
  }, [])

  useEffect(() => {
    if (!autoScanning) return

    const interval = setInterval(function () {
      runScanTick()
    }, 1000)

    return function () {
      clearInterval(interval)
    }
  }, [autoScanning, addedItems])

  async function refreshItems() {
    const items = await getQuoteItems(quoteId)
    setAddedItems(items)
  }

  async function runScanTick() {
    if (busyRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (
      !video ||
      !canvas ||
      video.readyState !== video.HAVE_ENOUGH_DATA
    ) {
      return
    }

    busyRef.current = true

    try {
      const base64 = captureFrameAsBase64(video, canvas)

      const result = await scanCardImage(base64)

      const top = result.candidates && result.candidates[0]

      if (!top) {
        lastKeyRef.current = null
        return
      }

      const variant = getFirstVariant(top)

      const currentKey = top.id + "|" + variant

      if (currentKey === lastKeyRef.current) {
        return
      }

      lastKeyRef.current = currentKey

      const existing = addedItems.find(function (item) {
        return (
          item.cards &&
          item.cards.id === top.id &&
          item.variant === variant
        )
      })

      if (existing) {
        const newQty = existing.quantity + 1

        await incrementQuoteItemQuantity(
          existing.id,
          newQty
        )

        setToast(
          "Now have " +
            newQty +
            "x " +
            top.name
        )
      } else {
        const formData = new FormData()

        formData.set(
          "quote_session_id",
          quoteId
        )

        formData.set(
          "card_id",
          top.id
        )

        formData.set(
          "variant",
          variant
        )

        formData.set(
          "condition",
          "NM"
        )

        formData.set(
          "quantity",
          1
        )

        formData.set(
          "is_graded",
          "no"
        )

        await addItemToQuote(formData)

        setToast(
          "Added: " +
            top.name
        )
      }

      await refreshItems()

      setTimeout(function () {
        setToast("")
      }, 2000)
    } catch (err) {
      // Silently ignore a single failed tick.
      // The next scan 1 second later will try again.
    } finally {
      busyRef.current = false
    }
  }

  async function handleRemove(itemId) {
    await removeQuoteItem(itemId)

    lastKeyRef.current = null

    refreshItems()
  }

  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : ""

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0d0d0d",
        padding: "24px 16px"
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto"
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            fontSize: 24,
            fontWeight: 900,
            marginBottom: 4
          }}
        >
          <span style={{ color: "#F2B705" }}>
            RMT
          </span>
          rading Cards - Get a Quote
        </h1>

        <p
          style={{
            color: "#9ca3af",
            fontSize: 13,
            marginBottom: 20
          }}
        >
          Hold each card flat in front of the camera.
          It's added automatically - just move to the
          next card when you're ready.
        </p>

        {cameraError ? (
          <p
            style={{
              color: "#f87171",
              marginBottom: 20
            }}
          >
            {cameraError}
          </p>
        ) : (
          <div
            style={{
              position: "relative",
              marginBottom: 8
            }}
          >
            <video
              ref={videoRef}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "2px solid #F2B705"
              }}
              muted
              playsInline
            />

            <canvas
              ref={canvasRef}
              style={{
                display: "none"
              }}
            />

            {toast && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  right: 12,
                  backgroundColor:
                    "rgba(0,0,0,0.8)",
                  color: "#F2B705",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: "center"
                }}
              >
                {toast}
              </div>
            )}
          </div>
        )}

        <button
          onClick={function () {
            setAutoScanning(!autoScanning)
          }}
          style={{
            backgroundColor: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 20
          }}
        >
          {autoScanning
            ? "Pause Scanning"
            : "Resume Scanning"}
        </button>

        {/* CARDS IN QUOTE */}

        <div
          style={{
            borderTop: "1px solid #2a2a2a",
            paddingTop: 16,
            marginBottom: 20
          }}
        >
          <h2
            style={{
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 12
            }}
          >
            Cards in this quote ({addedItems.length})
          </h2>

          {addedItems.length === 0 ? (
            <p
              style={{
                color: "#9ca3af",
                fontStyle: "italic",
                fontSize: 13
              }}
            >
              No cards added yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              {addedItems
                .slice()
                .reverse()
                .map(function (item) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: "#141414",
                        border:
                          "1px solid #2a2a2a",
                        borderRadius: 6,
                        padding: 10,
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        gap: 10
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        {item.cards?.image_small && (
                          <img
                            src={
                              item.cards
                                .image_small
                            }
                            alt={
                              item.cards.name
                            }
                            style={{
                              width: 40,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 4,
                              flexShrink: 0
                            }}
                          />
                        )}

                        <div
                          style={{
                            color: "#ffffff",
                            fontSize: 13
                          }}
                        >
                          {item.cards?.name} - Qty{" "}
                          {item.quantity}
                        </div>
                      </div>

                      <button
                        onClick={function () {
                          handleRemove(item.id)
                        }}
                        style={{
                          backgroundColor:
                            "#2a1414",
                          color: "#f87171",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* QR CODE */}

        {addedItems.length > 0 && (
          <div
            style={{
              textAlign: "center"
            }}
          >
            {!showQr ? (
              <button
                onClick={function () {
                  setAutoScanning(false)
                  setShowQr(true)
                }}
                style={{
                  backgroundColor: "#F2B705",
                  color: "#000",
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Done Scanning - Show My QR Code
              </button>
            ) : (
              <div
                style={{
                  backgroundColor: "#141414",
                  border:
                    "1px solid #F2B705",
                  borderRadius: 10,
                  padding: 20,
                  display: "inline-block"
                }}
              >
                <p
                  style={{
                    color: "#ffffff",
                    fontSize: 14,
                    marginBottom: 12
                  }}
                >
                  Show this to us
                </p>

                <img
                  src={
                    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
                    encodeURIComponent(
                      shareUrl
                    )
                  }
                  alt="QR code"
                  style={{
                    borderRadius: 6,
                    backgroundColor: "#ffffff",
                    padding: 8
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}