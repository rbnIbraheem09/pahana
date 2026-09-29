import jsQR from 'jsqr'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, CameraOff, CheckCircle2, Keyboard, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isCardId, normaliseCardId } from '@shared/random'
import { api } from '../api'
import { usePortal } from '../store'

type CamState = 'idle' | 'starting' | 'live' | 'unavailable'

/**
 * Scan a patient's clinic card. The QR holds only a random card ID; the
 * record is looked up on the clinic server and the access is logged.
 */
export function Scan() {
  const open = usePortal((s) => s.open)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cam, setCam] = useState<CamState>('idle')
  const [reason, setReason] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [found, setFound] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const lookup = async (raw: string) => {
    if (busy.current) return
    const id = normaliseCardId(raw)
    if (!isCardId(id)) {
      setError('That doesn’t look like a Pahana card ID (PH-XXXX-XXXX).')
      return
    }
    busy.current = true
    setError(null)
    try {
      const { patientId } = await api.card(id)
      setFound(id)
      setTimeout(() => open(patientId, 'scan'), 650)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Card not found')
      busy.current = false
    }
  }

  const start = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCam('unavailable')
      setReason('The camera only works when the portal is opened on this computer (localhost). Type the card ID instead.')
      return
    }
    setCam('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setCam('live')
    } catch {
      setCam('unavailable')
      setReason('No camera available, or permission was declined. Type the card ID instead.')
    }
  }

  // Decode loop
  useEffect(() => {
    if (cam !== 'live') return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 120) return
      last = t
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) return
      const w = 480
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(video, 0, 0, w, h)
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
      if (code?.data && isCardId(code.data)) void lookup(code.data)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cam])

  // Release the camera when leaving the page.
  useEffect(() => {
    const video = videoRef.current
    return () => {
      const stream = video?.srcObject as MediaStream | null
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  return (
    <div className="scroll h-full">
      <div className="mx-auto grid max-w-[1080px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-12 px-10 pt-10 pb-14 max-[900px]:grid-cols-1">
        <div className="viewfinder">
          <video ref={videoRef} playsInline muted className={cam === 'live' ? '' : 'hidden'} />
          <canvas ref={canvasRef} className="hidden" />
          {cam !== 'live' && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-[oklch(1_0_0/0.06)] text-[oklch(0.85_0.02_258)]">
                  {cam === 'unavailable' ? <CameraOff size={28} /> : <Camera size={28} />}
                </div>
                {cam === 'unavailable' ? (
                  <p className="max-w-[36ch] text-[13.5px] text-[oklch(0.8_0.02_258)]">{reason}</p>
                ) : (
                  <button className="btn btn-primary" disabled={cam === 'starting'} onClick={() => void start()}>
                    <Camera size={16} />
                    {cam === 'starting' ? 'Starting camera' : 'Start camera'}
                  </button>
                )}
              </div>
            </div>
          )}
          {cam === 'live' && <ScanFrame found={!!found} />}
          <AnimatePresence>
            {found && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 grid place-items-center bg-[oklch(0.15_0.03_258/0.6)] backdrop-blur-sm"
              >
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3 text-[oklch(0.97_0.01_258)]">
                  <CheckCircle2 size={44} className="text-green" />
                  <span className="mono text-[18px] font-bold">{found}</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-2">
          <h2 className="text-[28px]">Scan a clinic card</h2>
          <p className="mt-3 text-fg-2">
            Hold the patient’s Pahana card up to the camera. The record opens straight away. For the demo you can also show the card from the Pahana app’s
            Clinic cards screen.
          </p>
          <p className="mt-4 flex items-start gap-2 text-[13px] text-fg-3">
            <ShieldCheck size={15} className="mt-[2px] flex-none" />
            The QR code holds only a random card ID, never medical data. Every scan is written to the access log.
          </p>

          <div className="mt-8">
            <label className="field-label flex items-center gap-1.5">
              <Keyboard size={14} /> Or type the card ID
            </label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void lookup(manual)
              }}
            >
              <input
                className="input mono h-11 text-[15px] tracking-[0.06em] uppercase"
                placeholder="PH-XXXX-XXXX"
                value={manual}
                onChange={(e) => setManual(e.target.value.toUpperCase().slice(0, 12))}
              />
              <button className="btn btn-primary h-11" disabled={manual.replace(/[^0-9A-Z]/gi, '').length < 10}>
                Open
              </button>
            </form>
            {error && <p className="mt-2.5 text-[13px] text-red-text">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScanFrame({ found }: { found: boolean }) {
  const corner = 'absolute h-10 w-10 border-[oklch(0.97_0.01_258)]'
  return (
    <div className="pointer-events-none absolute inset-[16%]">
      <span className={`${corner} top-0 left-0 rounded-tl-[14px] border-t-[3px] border-l-[3px]`} />
      <span className={`${corner} top-0 right-0 rounded-tr-[14px] border-t-[3px] border-r-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-[14px] border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-[14px] border-r-[3px] border-b-[3px]`} />
      {!found && (
        <motion.span
          className="absolute inset-x-3 h-[2px] rounded-full bg-accent shadow-[0_0_14px_var(--accent)]"
          animate={{ top: ['8%', '92%', '8%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
