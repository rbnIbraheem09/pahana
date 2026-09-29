/**
 * Pahana mark: a clay oil lamp (පහන) with its flame.
 * The bowl follows currentColor; the flame keeps its warm light in both themes.
 */
export function LampMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <radialGradient id="pahana-glow" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="oklch(0.9 0.14 85)" stopOpacity="0.55" />
          <stop offset="1" stopColor="oklch(0.9 0.14 85)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pahana-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.93 0.12 95)" />
          <stop offset="1" stopColor="oklch(0.78 0.16 62)" />
        </linearGradient>
      </defs>
      <circle cx="9.5" cy="11.4" r="8" fill="url(#pahana-glow)" />
      {/* flame */}
      <path
        d="M9.5 4.6c2.3 3 3.5 5.1 3.5 7 0 2.1-1.55 3.6-3.5 3.6S6 13.7 6 11.6c0-1.9 1.2-4 3.5-7Z"
        fill="url(#pahana-flame)"
      />
      <path d="M9.5 9.8c.95 1.25 1.4 2.05 1.4 2.85 0 .85-.62 1.45-1.4 1.45s-1.4-.6-1.4-1.45c0-.8.45-1.6 1.4-2.85Z" fill="oklch(0.98 0.03 95)" />
      {/* bowl with wick lip */}
      <path
        d="M4.2 15.6h23.3c.5 0 .86.46.73.94C27 21.4 22.3 25 16.4 25c-5.1 0-9.3-2.7-11-6.6l-2.3-1.4c-.62-.38-.35-1.4.38-1.4h.72Z"
        fill="currentColor"
      />
      <rect x="12" y="25.6" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LampMark size={30} className="text-[color:var(--text)]" />
      <div className="leading-none">
        <div className="display text-[19px] font-[680] tracking-[-0.02em]">Pahana</div>
        {sub && <div className="mt-1 text-[11px] font-semibold tracking-[0.06em] text-fg-3 uppercase">{sub}</div>}
      </div>
    </div>
  )
}
