import type { Band, Lang } from '@shared/types'

export const BAND_NAME: Record<Band, Record<Lang, string>> = {
  red: { en: 'Red', si: 'රතු', ta: 'சிவப்பு' },
  amber: { en: 'Amber', si: 'කහ', ta: 'மஞ்சள்' },
  green: { en: 'Green', si: 'කොළ', ta: 'பச்சை' },
}

export const BAND_MEANING: Record<Band, Record<Lang, string>> = {
  red: { en: 'Review first', si: 'පළමුව බලන්න', ta: 'முதலில் பார்க்கவும்' },
  amber: { en: 'Review soon', si: 'ඉක්මනින් බලන්න', ta: 'விரைவில் பார்க்கவும்' },
  green: { en: 'Stable', si: 'ස්ථාවරයි', ta: 'நிலையானது' },
}

/**
 * Shape + colour, never colour alone: ▲ red, ◆ amber, ● green.
 * Readable for colour-blind users and on a monochrome printout.
 */
export function BandMark({ band, size = 10, className = '' }: { band: Band; size?: number; className?: string }) {
  const color = `var(--${band})`
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" className={`flex-none ${className}`} aria-hidden>
      {band === 'red' && <path d="M5 .6 9.6 9H.4Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth=".6" />}
      {band === 'amber' && <path d="M5 .4 9.6 5 5 9.6.4 5Z" fill={color} />}
      {band === 'green' && <circle cx="5" cy="5" r="4.4" fill={color} />}
    </svg>
  )
}

export function BandChip({
  band,
  lang = 'en',
  size = 'md',
  meaning = false,
}: {
  band: Band
  lang?: Lang
  size?: 'sm' | 'md'
  meaning?: boolean
}) {
  return (
    <span
      data-band={band}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${
        size === 'sm' ? 'h-[22px] px-2 text-[11px]' : 'h-[26px] px-2.5 text-xs'
      }`}
      style={{ background: 'var(--band-soft)', color: 'var(--band-text)', letterSpacing: lang === 'en' ? '0.04em' : 0 }}
    >
      <BandMark band={band} size={size === 'sm' ? 8 : 9} />
      <span className={lang === 'en' ? 'uppercase' : ''}>{BAND_NAME[band][lang]}</span>
      {meaning && <span className="font-medium opacity-80">· {BAND_MEANING[band][lang]}</span>}
    </span>
  )
}
