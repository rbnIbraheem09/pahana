import { motion, useAnimationControls } from 'motion/react'
import { ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { NexaLettering, NexaMark } from '@ui/Logo'
import { pair } from '../store'

/** Pairing: the six-digit code shown in the Nexa Health app on the clinic computer. */
export function Pair() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const shake = useAnimationControls()

  const submit = async (code: string) => {
    setBusy(true)
    setError(null)
    try {
      await pair(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pair')
      setDigits(Array(6).fill(''))
      void shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.42 } })
      setTimeout(() => refs.current[0]?.focus(), 50)
    } finally {
      setBusy(false)
    }
  }

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      // pasted a whole code
      const next = clean.slice(0, 6).split('')
      const filled = [...next, ...Array(6 - next.length).fill('')]
      setDigits(filled)
      if (next.length === 6) void submit(next.join(''))
      else refs.current[next.length]?.focus()
      return
    }
    const next = digits.slice()
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) refs.current[i + 1]?.focus()
    if (next.every((d) => d)) void submit(next.join(''))
  }

  return (
    <motion.div
      className="grid h-dvh place-items-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.7, bounce: 0 }}
        className="flex w-full max-w-[440px] flex-col items-center text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', duration: 0.8, bounce: 0 }}
          className="grid h-20 w-20 place-items-center rounded-[26px] bg-surface shadow-[inset_0_0_0_1px_var(--line-soft),0_20px_50px_-20px_oklch(0.6_0.18_240/0.4)]"
        >
          <NexaMark size={48} />
        </motion.div>
        <h1 className="mt-7 flex justify-center">
          <NexaLettering height={40} className="text-fg" />
        </h1>
        <p className="mt-4 max-w-[34ch] text-fg-3">Enter the pairing code shown in Nexa Health on the clinic computer.</p>

        <motion.div animate={shake} className="mt-8 flex gap-2 sm:gap-2.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              autoFocus={i === 0}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={`Digit ${i + 1}`}
              disabled={busy}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
                if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
                if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
              }}
              className="mono h-14 w-11 rounded-[12px] sm:h-16 sm:w-14 sm:rounded-[14px] border-0 bg-sunken text-center text-[28px] font-bold shadow-[inset_0_0_0_1px_var(--line)] transition-shadow duration-200 focus:bg-surface focus:shadow-[inset_0_0_0_1.5px_var(--accent),0_0_0_4px_var(--accent-soft)] sm:w-14"
            />
          ))}
        </motion.div>

        <div className="mt-4 min-h-[40px] text-[13px] text-red-text">{error}</div>

        <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-fg-4">
          <ShieldCheck size={14} />
          Every record you open is logged.
        </p>
      </motion.div>
    </motion.div>
  )
}
