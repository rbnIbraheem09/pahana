import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useField, type Flight } from '../store'

export function Toasts() {
  const toasts = useField((s) => s.toasts)
  const dismiss = useField((s) => s.dismiss)
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', duration: 0.42, bounce: 0 }}
          >
            <span className="mt-[1px] flex-none" style={{ color: t.tone === 'success' ? 'var(--green)' : t.tone === 'error' ? 'var(--red)' : 'var(--accent-text)' }}>
              {t.tone === 'success' ? <CheckCircle2 size={17} /> : t.tone === 'error' ? <AlertTriangle size={17} /> : <Info size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-[12.5px] text-fg-3">{t.body}</div>}
            </div>
            <button className="-mt-0.5 -mr-1 rounded p-0.5 text-fg-4 hover:text-fg-2" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * A saved record visibly travels from the Save button into the Sync outbox,
 * so the health worker sees where their work went.
 */
export function FlightLayer() {
  const flights = useField((s) => s.flights)
  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {flights.map((f) => (
        <FlightDot key={f.id} flight={f} />
      ))}
    </div>
  )
}

function target(): { x: number; y: number } {
  const candidates = ['[data-flight-target="outbox"]', '[data-flight-target="sync-button"]']
  for (const sel of candidates) {
    const el = document.querySelector(sel)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.left >= 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: 40, y: 40 }
}

function FlightDot({ flight }: { flight: Flight }) {
  const land = useField((s) => s.land)
  const to = target()
  const dx = to.x - flight.x
  const dy = to.y - flight.y
  const color = flight.band ? `var(--${flight.band})` : 'var(--accent)'
  // a gentle arc: rise first, then fall into the badge
  const lift = Math.min(-80, dy * 0.3 - 60)
  return (
    <motion.div
      className="absolute h-3 w-3 rounded-full"
      style={{ left: flight.x - 6, top: flight.y - 6, background: color, boxShadow: `0 0 0 4px oklch(from ${color} l c h / 0.25), 0 0 18px ${color}` }}
      initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
      animate={{
        x: [0, dx * 0.45, dx],
        y: [0, lift, dy],
        scale: [0.4, 1.15, 0.5],
        opacity: [0, 1, 0.9],
      }}
      transition={{ duration: 0.78, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={() => land(flight.id)}
    />
  )
}
