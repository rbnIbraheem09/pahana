import { HYPER_SYMPTOMS, HYPO_SYMPTOMS, SYMPTOMS } from './symptoms'
import type {
  Band,
  Condition,
  Reading,
  ReadingInput,
  SymptomKey,
  Trend,
  TriageReason,
  TriageResult,
} from './types'

/**
 * Pahana triage rules. Deterministic, explainable, and NOT a diagnosis:
 * the output only decides the order in which a doctor reviews patients.
 *
 * Thresholds follow WHO HEARTS / ISH 2020 blood-pressure grades and ADA
 * glucose targets. They are prototype values and must be validated against
 * Sri Lanka Ministry of Health NCD guidelines by a clinician before real use.
 */
export const RULES_VERSION = '0.3'

export const THRESHOLDS = {
  bpSevere: { sys: 180, dia: 110 },
  bpGrade2: { sys: 160, dia: 100 },
  bpTarget: { sys: 140, dia: 90 },
  bpLowSys: 90,
  glucoseVeryHigh: 300,
  glucoseHighWithSymptoms: 250,
  glucoseFastingTarget: 130,
  glucoseRandomTarget: 180,
  glucoseLow: 70,
  glucoseSevereLow: 54,
  missedDays: 3,
  trendSys: 20,
  trendGlucose: 50,
} as const

const RANK: Record<Band, number> = { green: 0, amber: 1, red: 2 }
const REASON_RANK: Record<Band | 'info', number> = { red: 3, amber: 2, green: 1, info: 0 }

export function worse(a: Band, b: Band): Band {
  return RANK[a] >= RANK[b] ? a : b
}

export function bandRank(b: Band): number {
  return RANK[b]
}

export interface TriageContext {
  /** Earlier readings for the same patient (any order, current one excluded or not). */
  history?: Pick<Reading, 'id' | 'takenAt' | 'sys' | 'dia' | 'glucose' | 'glucoseType'>[]
  conditions?: Condition[]
  /** id of the reading being triaged, so it can be excluded from history */
  readingId?: string
}

export function triage(r: ReadingInput, ctx: TriageContext = {}): TriageResult {
  const T = THRESHOLDS
  const reasons: TriageReason[] = []
  let band: Band = 'green'
  const flag = (reason: TriageReason) => {
    reasons.push(reason)
    if (reason.band !== 'info') band = worse(band, reason.band)
  }

  const hasBP = r.sys != null && r.dia != null && r.sys > 0 && r.dia > 0
  const sys = r.sys ?? 0
  const dia = r.dia ?? 0
  const bpSevere = hasBP && (sys >= T.bpSevere.sys || dia >= T.bpSevere.dia)
  const bpGrade2 = hasBP && !bpSevere && (sys >= T.bpGrade2.sys || dia >= T.bpGrade2.dia)
  const bpAbove = hasBP && !bpSevere && !bpGrade2 && (sys >= T.bpTarget.sys || dia >= T.bpTarget.dia)
  const bpLow = hasBP && sys < T.bpLowSys

  const hasGl = r.glucose != null && r.glucose > 0
  const g = r.glucose ?? 0
  const fasting = r.glucoseType === 'fasting'
  const target = fasting ? T.glucoseFastingTarget : T.glucoseRandomTarget
  const glAbove = hasGl && (fasting ? g > target : g >= target)
  const glVeryHigh = hasGl && g >= T.glucoseVeryHigh
  const glHigh250 = hasGl && g >= T.glucoseHighWithSymptoms
  const glLow = hasGl && g < T.glucoseLow
  const glSevereLow = hasGl && g < T.glucoseSevereLow

  const symptoms = unique(r.symptoms)
  const bySeverity = (sev: string) => symptoms.filter((s) => SYMPTOMS[s]?.severity === sev)
  const urgent = bySeverity('urgent')
  const warning = bySeverity('warning')
  const watch = bySeverity('watch')
  const minor = bySeverity('minor')
  const hypo = symptoms.filter((s) => HYPO_SYMPTOMS.includes(s))
  const hyper = symptoms.filter((s) => HYPER_SYMPTOMS.includes(s))
  const bp = { sys, dia }

  /* Blood pressure ------------------------------------------------- */
  if (bpSevere) flag({ code: 'bp_severe', band: 'red', params: bp })
  else if (bpGrade2) flag({ code: 'bp_grade2', band: 'amber', params: bp })
  else if (bpAbove) flag({ code: 'bp_above', band: 'amber', params: bp })
  if (bpLow) {
    const withSymptoms = symptoms.filter((s) => s === 'dizziness' || s === 'fainting')
    if (withSymptoms.length) flag({ code: 'bp_low_symptoms', band: 'red', params: { ...bp, symptoms: withSymptoms.join(',') } })
    else flag({ code: 'bp_low', band: 'amber', params: bp })
  }

  /* Glucose --------------------------------------------------------- */
  const gp = { glucose: g, type: fasting ? 'FBS' : 'RBS', target }
  if (hasGl) {
    if (glSevereLow) flag({ code: 'gl_low_severe', band: 'red', params: gp })
    else if (glLow && hypo.length) flag({ code: 'gl_low_symptoms', band: 'red', params: { ...gp, symptoms: hypo.join(',') } })
    else if (glLow) flag({ code: 'gl_low', band: 'amber', params: gp })
    else if (glVeryHigh) flag({ code: 'gl_very_high', band: 'red', params: gp })
    else if (glHigh250 && hyper.length) flag({ code: 'gl_high_symptoms', band: 'red', params: { ...gp, symptoms: hyper.join(',') } })
    else if (glAbove) flag({ code: 'gl_above', band: 'amber', params: gp })
  }

  /* Symptoms -------------------------------------------------------- */
  if (urgent.length) flag({ code: 'sym_urgent', band: 'red', params: { symptoms: urgent.join(',') } })
  if (warning.length) {
    const context = bpSevere || bpGrade2 ? 'bp' : glHigh250 ? 'high_glucose' : glLow ? 'low_glucose' : null
    if (context) flag({ code: 'sym_warning_combo', band: 'red', params: { symptoms: warning.join(','), context } })
    else flag({ code: 'sym_warning', band: 'amber', params: { symptoms: warning.join(',') } })
  }
  if (watch.length) flag({ code: 'sym_watch', band: 'amber', params: { symptoms: watch.join(',') } })

  /* Medication ------------------------------------------------------ */
  const aboveTarget = bpSevere || bpGrade2 || bpAbove || glAbove
  const missed = clamp(Math.round(r.missedDays || 0), 0, 7)
  if (missed >= T.missedDays) flag({ code: 'med_missed', band: 'amber', params: { days: missed } })
  else if (missed >= 1 && aboveTarget) flag({ code: 'med_missed_uncontrolled', band: 'amber', params: { days: missed } })

  /* Trend ----------------------------------------------------------- */
  const trend = computeTrend(r, ctx)
  if (trend.sysDelta != null && trend.sysDelta >= T.trendSys) flag({ code: 'trend_bp', band: 'amber', params: { delta: trend.sysDelta } })
  if (trend.glucoseDelta != null && trend.glucoseDelta >= T.trendGlucose)
    flag({ code: 'trend_gl', band: 'amber', params: { delta: trend.glucoseDelta } })

  if (band === 'green') reasons.push({ code: 'in_target', band: 'green' })
  if (ctx.conditions?.includes('diabetes') && !hasGl) reasons.push({ code: 'no_glucose', band: 'info' })

  /* Priority score (orders patients within a band) ------------------ */
  let score = 0
  if (hasBP) score += Math.max(0, sys - 130) * 0.6 + Math.max(0, dia - 85) * 0.8 + Math.max(0, T.bpLowSys - sys) * 1.2
  if (hasGl) score += Math.max(0, g - target) * 0.15 + Math.max(0, T.glucoseLow - g) * 1.5
  score += urgent.length * 30 + warning.length * 12 + watch.length * 6 + minor.length * 2
  score += missed * 3
  if (trend.sysDelta && trend.sysDelta > 0) score += trend.sysDelta * 0.4
  if (trend.glucoseDelta && trend.glucoseDelta > 0) score += trend.glucoseDelta * 0.08

  reasons.sort((a, b) => REASON_RANK[b.band] - REASON_RANK[a.band])
  return { band, score: Math.round(score), reasons, trend }
}

export function computeTrend(r: ReadingInput, ctx: TriageContext): Trend {
  const now = Date.parse(r.takenAt) || Date.now()
  const window = 200 * 86_400_000
  const prev = (ctx.history ?? [])
    .filter((h) => h.id !== ctx.readingId)
    .filter((h) => {
      const t = Date.parse(h.takenAt)
      return t < now && now - t <= window
    })
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .slice(0, 3)

  if (!prev.length) return { direction: 'none', sysDelta: null, glucoseDelta: null }

  const sysPrev = prev.map((p) => p.sys).filter((v): v is number => v != null && v > 0)
  const sysDelta = r.sys && sysPrev.length ? Math.round(r.sys - mean(sysPrev)) : null

  const glPrev = prev
    .filter((p) => p.glucoseType === r.glucoseType)
    .map((p) => p.glucose)
    .filter((v): v is number => v != null && v > 0)
  const glucoseDelta = r.glucose && glPrev.length ? Math.round(r.glucose - mean(glPrev)) : null

  let direction: Trend['direction'] = 'flat'
  if (sysDelta != null) direction = sysDelta >= 8 ? 'up' : sysDelta <= -8 ? 'down' : 'flat'
  else if (glucoseDelta != null) direction = glucoseDelta >= 25 ? 'up' : glucoseDelta <= -25 ? 'down' : 'flat'
  return { direction, sysDelta, glucoseDelta }
}

/** Sort comparator: red → amber → green, then highest score, then longest waiting. */
export function comparePriority(
  a: { band: Band; score: number; takenAt: string },
  b: { band: Band; score: number; takenAt: string },
): number {
  return RANK[b.band] - RANK[a.band] || b.score - a.score || Date.parse(a.takenAt) - Date.parse(b.takenAt)
}

export interface RuleRow {
  area: string
  band: Band
  rule: string
  basis: string
}

/** Human-readable rule table (shown in the portal's Rules page). */
export const RULE_TABLE: RuleRow[] = [
  { area: 'Blood pressure', band: 'red', rule: 'Systolic ≥ 180 or diastolic ≥ 110', basis: 'ISH 2020 grade 3 / WHO HEARTS severe' },
  { area: 'Blood pressure', band: 'red', rule: 'Systolic < 90 with dizziness or fainting', basis: 'Symptomatic hypotension' },
  { area: 'Blood pressure', band: 'amber', rule: 'Systolic 160–179 or diastolic 100–109', basis: 'ISH 2020 grade 2' },
  { area: 'Blood pressure', band: 'amber', rule: 'Systolic 140–159 or diastolic 90–99', basis: 'Above treatment target (140/90)' },
  { area: 'Blood pressure', band: 'amber', rule: 'Systolic < 90', basis: 'Low blood pressure' },
  { area: 'Glucose', band: 'red', rule: '≥ 300 mg/dL', basis: 'Severe hyperglycaemia' },
  { area: 'Glucose', band: 'red', rule: '≥ 250 mg/dL with thirst, urination, vomiting or confusion', basis: 'Possible hyperglycaemic crisis' },
  { area: 'Glucose', band: 'red', rule: '< 54 mg/dL, or < 70 with sweating, confusion, dizziness or fainting', basis: 'ADA level-2 / symptomatic hypoglycaemia' },
  { area: 'Glucose', band: 'amber', rule: 'Fasting > 130 or random ≥ 180 mg/dL', basis: 'ADA glycaemic targets' },
  { area: 'Glucose', band: 'amber', rule: '54–69 mg/dL', basis: 'ADA level-1 hypoglycaemia' },
  { area: 'Symptoms', band: 'red', rule: 'Chest pain, breathlessness, one-sided weakness, confusion, fainting', basis: 'Red-flag symptoms' },
  { area: 'Symptoms', band: 'red', rule: 'Dizziness, severe headache, blurred vision, vomiting or sweating with grade-2+ BP or glucose ≥ 250 / < 70', basis: 'Symptomatic uncontrolled reading' },
  { area: 'Symptoms', band: 'amber', rule: 'Any warning symptom on its own; foot wound; ankle swelling', basis: 'Needs clinical review' },
  { area: 'Medication', band: 'amber', rule: 'Missed ≥ 3 of the last 7 days, or any missed day with readings above target', basis: 'Adherence' },
  { area: 'Trend', band: 'amber', rule: 'Systolic up ≥ 20 mmHg or glucose up ≥ 50 mg/dL vs the last 3 visits', basis: 'Worsening control' },
  { area: 'All', band: 'green', rule: 'Everything within target and no warning symptoms', basis: 'Stable: can skip the trip' },
]

function unique(keys: SymptomKey[]): SymptomKey[] {
  return Array.from(new Set(keys ?? []))
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
