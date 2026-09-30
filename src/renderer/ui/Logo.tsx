import { useId } from 'react'

/**
 * Nexa Health mark: a rounded "N" stroke with four dots, cyan into royal blue.
 * Drawn on a 32-unit grid from the brand artwork so it stays crisp at any size.
 */
export function NexaMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1fe3f7" />
          <stop offset="0.55" stopColor="#1fb2f2" />
          <stop offset="1" stopColor="#1f5fe0" />
        </linearGradient>
        <linearGradient id={`${id}-cyan`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#35e2f8" />
          <stop offset="1" stopColor="#14b6ec" />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#2f86f0" />
          <stop offset="1" stopColor="#1f58dc" />
        </linearGradient>
      </defs>
      <circle cx="24.64" cy="14.31" r="3.4" fill={`url(#${id}-blue)`} />
      <circle cx="24.93" cy="5.0" r="4.66" fill={`url(#${id}-cyan)`} />
      <circle cx="6.01" cy="17.9" r="4.37" fill={`url(#${id}-blue)`} />
      <circle cx="6.69" cy="27.6" r="3.9" fill={`url(#${id}-cyan)`} />
      <rect x="-1.54" y="8.63" width="35.27" height="11.06" rx="5.53" transform="translate(0.35 0.75) rotate(43.86 16.1 14.16)" fill="#0a1a44" opacity="0.22" />
      <rect x="-1.54" y="8.63" width="35.27" height="11.06" rx="5.53" transform="rotate(43.86 16.1 14.16)" fill={`url(#${id}-bar)`} />
    </svg>
  )
}

/**
 * "NEXA / HEALTH" lettering, drawn as geometry (not a font) so it matches the brand artwork
 * everywhere. Width follows `height`; colour follows currentColor.
 */
export function NexaLettering({ height = 30, className = '' }: { height?: number; className?: string }) {
  return (
    <svg height={height} width={(height * 52.7) / 18.5} viewBox="0 0 52.7 18.5" className={className} aria-label="Nexa Health" role="img">
      <g fill="currentColor">
        {/* N */}
        <rect x="0" y="0" width="2.3" height="10" />
        <rect x="8.4" y="0" width="2.3" height="10" />
        <path d="M0 0h3.1l7.6 10H7.6Z" />
        {/* E */}
        <rect x="15.2" y="0" width="2.3" height="10" />
        <rect x="15.2" y="0" width="8.8" height="2.05" />
        <rect x="15.2" y="3.98" width="8.1" height="2.05" />
        <rect x="15.2" y="7.95" width="8.8" height="2.05" />
        {/* X */}
        <path d="M27.3 0h3.1l8.3 10h-3.1Z" />
        <path d="M35.6 0h3.1l-8.3 10h-3.1Z" />
        {/* Λ */}
        <path d="M40.5 10 45.3 0h2.5l4.8 10H50l-3.45-7.19L43.1 10Z" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="0.62">
        <path d="M.61 14v4.5M3.79 14v4.5M.61 16.25h3.18" />
        <path d="M10.47 14v4.5M10.16 14.31h3.2M10.16 16.25h2.84M10.16 18.19h3.2" />
        <path d="M19.72 18.5l1.8-4.2 1.8 4.2M20.35 17h2.34" strokeLinejoin="round" />
        <path d="M29.99 14v4.19h2.69" />
        <path d="M38.74 14.31h3.8M40.64 14.31v4.19" />
        <path d="M48.91 14v4.5M52.09 14v4.5M48.91 16.25h3.18" />
      </g>
    </svg>
  )
}

/** Mark + lettering, with an optional product label after a hairline. */
export function Wordmark({ sub, size = 'md' }: { sub?: string; size?: 'sm' | 'md' }) {
  const mark = size === 'sm' ? 28 : 32
  const letters = size === 'sm' ? 24 : 27
  return (
    <div className="flex items-center gap-2.5">
      <NexaMark size={mark} />
      <NexaLettering height={letters} className="flex-none" />
      {sub && (
        <>
          <span className="mx-0.5 h-6 w-px flex-none bg-[color:var(--line)]" aria-hidden />
          <span className="truncate text-[11px] leading-tight font-bold tracking-[0.1em] text-fg-3 uppercase">{sub}</span>
        </>
      )}
    </div>
  )
}
