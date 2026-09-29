import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

export const spring = { type: 'spring', duration: 0.42, bounce: 0 } as const
export const springSnappy = { type: 'spring', duration: 0.3, bounce: 0 } as const
export const easeOut = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

/** Segmented control with a sliding thumb. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative inline-flex rounded-[10px] bg-sunken p-[3px] shadow-[inset_0_0_0_1px_var(--line-soft)] ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative z-0 flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-semibold transition-colors duration-150 ${
              size === 'sm' ? 'h-[26px] px-2.5 text-[12px]' : 'h-[32px] px-3.5 text-[13px]'
            } ${active ? 'text-fg' : 'text-fg-3 hover:text-fg-2'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={springSnappy}
                className="absolute inset-0 -z-10 rounded-[8px] bg-surface-2 shadow-[0_1px_2px_oklch(0.1_0.03_258/0.25),inset_0_0_0_1px_var(--line-soft)]"
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  tone = 'accent',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
  tone?: 'accent' | 'green'
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-[24px] w-[42px] flex-none items-center rounded-full p-[3px] transition-colors duration-200 disabled:opacity-40"
      style={{ background: checked ? `var(--${tone})` : 'var(--surface-3)' }}
    >
      <motion.span
        className="h-[18px] w-[18px] rounded-full bg-[oklch(0.99_0.003_258)] shadow-[0_1px_3px_oklch(0.1_0.03_258/0.4)]"
        animate={{ x: checked ? 18 : 0 }}
        transition={springSnappy}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */

/** Number that rolls digit-by-digit when it changes. */
export function Odometer({ value, className = '' }: { value: number; className?: string }) {
  const text = Math.max(0, Math.round(value)).toLocaleString('en-GB')
  return (
    <span className={`tnum inline-flex overflow-hidden ${className}`} aria-label={text}>
      {text.split('').map((ch, i) => {
        const key = text.length - i // keep columns stable from the right
        if (!/\d/.test(ch))
          return (
            <span key={`s${key}`} aria-hidden>
              {ch}
            </span>
          )
        return <Digit key={`d${key}`} digit={Number(ch)} />
      })}
    </span>
  )
}

function Digit({ digit }: { digit: number }) {
  return (
    <span aria-hidden className="relative inline-block h-[1.15em] overflow-hidden" style={{ width: '0.62em' }}>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-digit * 1.15}em` }}
        transition={{ type: 'spring', duration: 0.7, bounce: 0 }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1.15em] leading-[1.15em]">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/* ------------------------------------------------------------------ */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

/** A small circular progress ring. */
export function Ring({ progress, size = 16, stroke = 2 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, progress))) }}
        transition={{ duration: 0.35, ease: easeOut }}
      />
    </svg>
  )
}
