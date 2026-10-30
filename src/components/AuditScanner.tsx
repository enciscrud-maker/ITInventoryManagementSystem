"use client"

/**
 * Continuous scanner shared by the whole stock opname session.
 * - Camera: decodes QR codes with jsQR; the same code must leave the frame
 *   (or 1s must pass without seeing it) before it can be counted again.
 * - Hardware scanners (USB/Bluetooth) type the code + Enter into the input.
 * The parent decides what a code means and returns the result to display.
 */

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, X } from "lucide-react"
import { Button, IconButton } from "./ui"
import { cn } from "../utils/helpers"
import type { AuditScanResult } from "../utils/audit"

type ScanEvent = AuditScanResult & { id: number, code: string }
export function AuditScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => AuditScanResult
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [manual, setManual] = useState("")
  const [events, setEvents] = useState<ScanEvent[]>([])
  const counter = useRef(0)

  const handleCode = (code: string) => {
    const clean = code.trim()
    if (!clean) return
    const result = onScan(clean)
    counter.current += 1
    setEvents((list) =>
      [{ ...result, id: counter.current, code: clean }, ...list].slice(0, 8),
    )
    if (result.ok) navigator.vibrate?.(40)
  }
  const handleCodeRef = useRef(handleCode)
  handleCodeRef.current = handleCode

  useEffect(() => {
    if (!cameraOn) return
    let stopped = false
    let stream: MediaStream | null = null
    let raf = 0
    let lastRun = 0
    const lastSeen = { code: "", at: 0 }
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera is not available. Open the app over HTTPS or localhost.",
          )
        const { default: jsQR } = await import("jsqr")
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const tick = (time: number) => {
          if (stopped) return
          raf = requestAnimationFrame(tick)
          if (time - lastRun < 120 || video.readyState < 2 || !ctx) return
          if (!video.videoWidth || !video.videoHeight) return
          lastRun = time
          const scale = Math.min(1, 640 / video.videoWidth)
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const hit = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: "dontInvert",
          })
          if (!hit?.data) return
          const now = Date.now()
          const sameCode = hit.data === lastSeen.code
          const stillInFrame = now - lastSeen.at < 1000
          lastSeen.at = now
          if (sameCode && stillInFrame) return
          lastSeen.code = hit.data
          handleCodeRef.current(hit.data)
        }
        raf = requestAnimationFrame(tick)
      } catch (error) {
        if (stopped) return
        setCameraError(
          error instanceof Error ? error.message : "Unable to start the camera",
        )
        setCameraOn(false)
      }
    }
    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cameraOn])

  const latest = events[0]
  return (
    <section className="scan-panel" aria-label="QR scanner">
      <header>
        <div>
          <strong>Scan QR / Barcode</strong>
          <small>
            Each scan adds +1 to Physical Qty. Assets outside this session are
            ignored.
          </small>
        </div>
        <IconButton label="Close scanner" onClick={onClose}>
          <X size={17} />
        </IconButton>
      </header>
      <div className="scan-body">
        <div className="scan-camera">
          {cameraOn ? (
            <div className="scan-view">
              <video ref={videoRef} muted playsInline />
              <span className="scan-reticle" />
            </div>
          ) : (
            <div className="scan-camera-off">
              <Camera size={28} />
              <span>Camera is off</span>
            </div>
          )}
          <Button
            size="sm"
            variant={cameraOn ? "secondary" : "primary"}
            onClick={() => {
              setCameraError("")
              setCameraOn((value) => !value)
            }}
          >
            {cameraOn ? (
              <>
                <CameraOff size={15} /> Stop camera
              </>
            ) : (
              <>
                <Camera size={15} /> Start camera
              </>
            )}
          </Button>
          {cameraError && <small className="error">{cameraError}</small>}
        </div>
        <div className="scan-side">
          <label className="field">
            <span>
              Scanner input (USB / Bluetooth scanner or type an Asset ID)
            </span>
            <input
              autoFocus
              value={manual}
              placeholder="Scan here, then Enter"
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                handleCode(manual)
                setManual("")
              }}
            />
          </label>
          <div
            className={cn(
              "scan-feedback",
              latest ? (latest.ok ? "scan-ok" : "scan-bad") : "",
            )}
            role="status"
            aria-live="polite"
          >
            {latest ? latest.message : "Waiting for a scan…"}
          </div>
          {events.length > 0 && (
            <ul className="scan-log">
              {events.map((event) => (
                <li
                  key={event.id}
                  className={event.ok ? "scan-ok" : "scan-bad"}
                >
                  <code>{event.code.slice(0, 32)}</code>
                  <span>{event.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
