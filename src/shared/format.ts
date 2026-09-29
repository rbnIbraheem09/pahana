import type { Lang } from './types'

const LOCALE: Record<Lang, string> = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' }

export const DAY_MS = 86_400_000

export function localeFor(lang: Lang): string {
  return LOCALE[lang]
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(t: number | Date = Date.now()): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)
}

/** "3 min ago", "2 h ago", "yesterday", "12 Sep" */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never'
  const t = Date.parse(iso)
  const s = Math.round((now - t) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  const days = daysBetween(t, now)
  if (days === 0) return `${h} h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return shortDate(iso)
}

export function shortDate(iso: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short' }).format(new Date(iso))
}

export function longDate(iso: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  )
}

export function timeOfDay(iso: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return '•••'
  return `+94 ${digits.slice(2, 4)} ••• •• ${digits.slice(-2)}`
}

export function maskNic(nic: string | null): string | null {
  if (!nic) return null
  return `${'•'.repeat(Math.max(0, nic.length - 4))}${nic.slice(-4)}`
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s.]/gu, '').split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`
}
