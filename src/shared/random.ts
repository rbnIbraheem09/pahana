/** Small deterministic PRNG (mulberry32) so demo data is identical on every reset. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]
  const chance = (p: number) => next() < p
  const normal = (mu: number, sigma: number) => {
    const u = 1 - next()
    const v = next()
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join('')
  const shuffle = <T>(xs: T[]): T[] => {
    const out = xs.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  return { next, int, pick, chance, normal, hex, shuffle }
}

export type Rng = ReturnType<typeof createRng>

/** Crockford base32 without ambiguous characters (no I, L, O, U). */
const CARD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function cardIdFrom(rand: () => number): string {
  const chunk = () => Array.from({ length: 4 }, () => CARD_ALPHABET[Math.floor(rand() * 32)]).join('')
  return `PH-${chunk()}-${chunk()}`
}

export function isCardId(s: string): boolean {
  return /^PH-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(s.trim().toUpperCase())
}

export function normaliseCardId(s: string): string {
  const raw = s.trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  const body = raw.startsWith('PH') ? raw.slice(2) : raw
  if (body.length !== 8) return s.trim().toUpperCase()
  return `PH-${body.slice(0, 4)}-${body.slice(4)}`
}
