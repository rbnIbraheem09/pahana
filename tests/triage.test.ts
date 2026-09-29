import { describe, expect, it } from 'vitest'
import { formatReason } from '@shared/reasons'
import { generateDemo } from '@shared/seed'
import { comparePriority, triage } from '@shared/triage'
import type { Band, ReadingInput } from '@shared/types'

const at = '2026-09-29T09:00:00.000Z'
const r = (over: Partial<ReadingInput>): ReadingInput => ({
  sys: 124,
  dia: 78,
  glucose: 110,
  glucoseType: 'fasting',
  symptoms: [],
  missedDays: 0,
  takenAt: at,
  ...over,
})
const band = (over: Partial<ReadingInput>) => triage(r(over)).band

describe('blood pressure', () => {
  it('is green within target', () => expect(band({ sys: 138, dia: 88 })).toBe('green'))
  it('is amber above 140/90', () => expect(band({ sys: 140, dia: 80 })).toBe('amber'))
  it('is amber in grade 2', () => expect(band({ sys: 165, dia: 95 })).toBe('amber'))
  it('is red at 180 systolic', () => expect(band({ sys: 180, dia: 90 })).toBe('red'))
  it('is red at 110 diastolic', () => expect(band({ sys: 150, dia: 110 })).toBe('red'))
  it('is amber when low without symptoms', () => expect(band({ sys: 86, dia: 58 })).toBe('amber'))
  it('is red when low with fainting', () => expect(band({ sys: 86, dia: 58, symptoms: ['fainting'] })).toBe('red'))
})

describe('glucose', () => {
  it('fasting 130 is on target', () => expect(band({ glucose: 130 })).toBe('green'))
  it('fasting 131 is above target', () => expect(band({ glucose: 131 })).toBe('amber'))
  it('random 179 is on target', () => expect(band({ glucose: 179, glucoseType: 'random' })).toBe('green'))
  it('random 180 is above target', () => expect(band({ glucose: 180, glucoseType: 'random' })).toBe('amber'))
  it('300+ is red', () => expect(band({ glucose: 300, glucoseType: 'random' })).toBe('red'))
  it('260 alone is amber', () => expect(band({ glucose: 260, glucoseType: 'random' })).toBe('amber'))
  it('260 with thirst is red', () => expect(band({ glucose: 260, glucoseType: 'random', symptoms: ['thirst'] })).toBe('red'))
  it('65 alone is amber', () => expect(band({ glucose: 65 })).toBe('amber'))
  it('65 with sweating is red', () => expect(band({ glucose: 65, symptoms: ['sweating'] })).toBe('red'))
  it('under 54 is red', () => expect(band({ glucose: 50 })).toBe('red'))
})

describe('symptoms and medication', () => {
  it('chest pain is always red', () => expect(band({ symptoms: ['chest_pain'] })).toBe('red'))
  it('dizziness alone is amber', () => expect(band({ symptoms: ['dizziness'] })).toBe('amber'))
  it('dizziness with grade-2 BP is red', () => expect(band({ sys: 164, dia: 96, symptoms: ['dizziness'] })).toBe('red'))
  it('tiredness alone stays green', () => expect(band({ symptoms: ['tiredness'] })).toBe('green'))
  it('foot wound is amber', () => expect(band({ symptoms: ['foot_wound'] })).toBe('amber'))
  it('missing 3 days is amber', () => expect(band({ missedDays: 3 })).toBe('amber'))
  it('missing 1 day while controlled stays green', () => expect(band({ missedDays: 1 })).toBe('green'))
})

describe('explanations', () => {
  const reasons = (over: Partial<ReadingInput>) => triage(r(over)).reasons.filter((x) => x.band !== 'green').map((x) => formatReason(x))
  it('does not repeat a symptom already explained by low BP', () =>
    expect(reasons({ sys: 85, dia: 55, symptoms: ['dizziness'] })).toEqual(['Low BP (85/55) with dizziness']))
  it('does not repeat a symptom already explained by low glucose', () =>
    expect(reasons({ glucose: 62, symptoms: ['sweating'] })).toEqual(['Low glucose (62) with sweating / shaking']))
  it('reads naturally for high glucose with thirst', () =>
    expect(reasons({ glucose: 260, glucoseType: 'random', symptoms: ['thirst'] })).toEqual(['Glucose 260 mg/dL with excessive thirst']))
})

describe('trend', () => {
  it('flags a 20 mmHg rise as amber', () => {
    const history = [
      { id: 'a', takenAt: '2026-06-01T09:00:00Z', sys: 112, dia: 74, glucose: null, glucoseType: 'fasting' as const },
      { id: 'b', takenAt: '2026-07-01T09:00:00Z', sys: 114, dia: 74, glucose: null, glucoseType: 'fasting' as const },
      { id: 'c', takenAt: '2026-08-01T09:00:00Z', sys: 113, dia: 75, glucose: null, glucoseType: 'fasting' as const },
    ]
    const res = triage(r({ sys: 134, dia: 82 }), { history })
    expect(res.band).toBe('amber')
    expect(res.trend.direction).toBe('up')
    expect(res.reasons.map((x) => x.code)).toContain('trend_bp')
  })
})

describe('Patient #0842 from the mockup', () => {
  it('is red, rising, and explains why', () => {
    const history = [
      { id: 'a', takenAt: '2026-06-01T09:00:00Z', sys: 148, dia: 92, glucose: 138, glucoseType: 'random' as const },
      { id: 'b', takenAt: '2026-07-01T09:00:00Z', sys: 152, dia: 96, glucose: 145, glucoseType: 'random' as const },
      { id: 'c', takenAt: '2026-08-01T09:00:00Z', sys: 158, dia: 98, glucose: 132, glucoseType: 'random' as const },
    ]
    const res = triage(r({ sys: 168, dia: 102, glucose: 140, glucoseType: 'random', symptoms: ['dizziness'], missedDays: 2 }), {
      history,
    })
    expect(res.band).toBe('red')
    expect(res.trend.direction).toBe('up')
    const text = res.reasons.map((x) => formatReason(x))
    expect(text[0]).toBe('Dizziness with BP above 160/100')
    expect(text).toContain('Missed medication 2 days while above target')
    expect(formatReason(res.reasons[0], 'ta')).toContain('தலைச்சுற்றல்')
  })
})

describe('ordering', () => {
  it('sorts red before amber before green, then by score', () => {
    const items = [
      { band: 'green' as Band, score: 90, takenAt: at },
      { band: 'red' as Band, score: 10, takenAt: at },
      { band: 'amber' as Band, score: 40, takenAt: at },
      { band: 'red' as Band, score: 50, takenAt: at },
    ].sort(comparePriority)
    expect(items.map((i) => `${i.band}${i.score}`)).toEqual(['red50', 'red10', 'amber40', 'green90'])
  })
})

describe('demo data', () => {
  const { clinic, field } = generateDemo(Date.parse('2026-09-29T08:30:00Z'))

  const countAwaiting = (readings: typeof clinic.readings) => {
    const decided = new Set(clinic.decisions.map((d) => d.readingId))
    const counts: Record<Band, number> = { red: 0, amber: 0, green: 0 }
    for (const p of clinic.patients) {
      const mine = readings.filter((x) => x.patientId === p.id).sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
      const latest = mine[mine.length - 1]
      if (!latest || decided.has(latest.id)) continue
      counts[triage(latest, { history: mine.slice(0, -1), conditions: p.conditions, readingId: latest.id }).band]++
    }
    return counts
  }

  it('has 478 clinic patients and a 60-patient field caseload', () => {
    expect(clinic.patients).toHaveLength(478)
    expect(field.patients).toHaveLength(60)
  })

  it('has 48 unsynced readings on the field device', () => {
    expect(field.readings.filter((x) => !x.syncedAt)).toHaveLength(48)
  })

  it('shows 5 / 27 / 386 before sync', () => {
    expect(countAwaiting(clinic.readings)).toEqual({ red: 5, amber: 27, green: 386 })
  })

  it('shows 8 / 31 / 427 after sync (the mockup numbers)', () => {
    const merged = [...clinic.readings, ...field.readings.filter((x) => !x.syncedAt)]
    expect(countAwaiting(merged)).toEqual({ red: 8, amber: 31, green: 427 })
  })

  it('includes Patient #0842', () => {
    const p = clinic.patients.find((x) => x.code === '0842')
    expect(p?.name).toBe('Muthulakshmi Ramasamy')
    expect(field.patients.some((x) => x.code === '0842')).toBe(true)
  })

  it('card IDs are unique and carry no personal data', () => {
    const ids = new Set(clinic.patients.map((p) => p.cardId))
    expect(ids.size).toBe(clinic.patients.length)
    for (const p of clinic.patients) expect(p.cardId).toMatch(/^PH-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  })
})
