import type { Condition, Lang, SymptomKey } from './types'

/**
 * urgent  – RED on its own
 * warning – AMBER on its own, RED alongside grade-2+ BP or glucose ≥250 / <70
 * watch   – AMBER on its own
 * minor   – adds to priority score only (context for the doctor)
 */
export type SymptomSeverity = 'urgent' | 'warning' | 'watch' | 'minor'

export interface SymptomDef {
  key: SymptomKey
  severity: SymptomSeverity
  label: Record<Lang, string>
}

export const SYMPTOM_LIST: SymptomDef[] = [
  { key: 'chest_pain', severity: 'urgent', label: { en: 'Chest pain', si: 'පපුවේ වේදනාව', ta: 'நெஞ்சு வலி' } },
  { key: 'breathless', severity: 'urgent', label: { en: 'Short of breath', si: 'හුස්ම ගැනීමේ අපහසුව', ta: 'மூச்சுத் திணறல்' } },
  { key: 'weakness', severity: 'urgent', label: { en: 'One-sided weakness', si: 'එක් පැත්තක දුර්වලතාවය', ta: 'ஒரு பக்க பலவீனம்' } },
  { key: 'confusion', severity: 'urgent', label: { en: 'Confusion', si: 'ව්‍යාකූල බව', ta: 'குழப்பம்' } },
  { key: 'fainting', severity: 'urgent', label: { en: 'Fainting', si: 'ක්ලාන්ත වීම', ta: 'மயக்கம்' } },
  { key: 'dizziness', severity: 'warning', label: { en: 'Dizziness', si: 'කරකැවිල්ල', ta: 'தலைச்சுற்றல்' } },
  { key: 'headache', severity: 'warning', label: { en: 'Severe headache', si: 'දැඩි හිසරදය', ta: 'கடுமையான தலைவலி' } },
  { key: 'blurred_vision', severity: 'warning', label: { en: 'Blurred vision', si: 'පෙනීම බොඳ වීම', ta: 'மங்கலான பார்வை' } },
  { key: 'vomiting', severity: 'warning', label: { en: 'Vomiting', si: 'වමනය', ta: 'வாந்தி' } },
  { key: 'sweating', severity: 'warning', label: { en: 'Sweating / shaking', si: 'දහඩිය / වෙව්ලීම', ta: 'வியர்வை / நடுக்கம்' } },
  { key: 'foot_wound', severity: 'watch', label: { en: 'Foot wound', si: 'පාදයේ තුවාලයක්', ta: 'காலில் புண்' } },
  { key: 'swelling', severity: 'watch', label: { en: 'Ankle swelling', si: 'වළලුකර ඉදිමීම', ta: 'கணுக்கால் வீக்கம்' } },
  { key: 'thirst', severity: 'minor', label: { en: 'Very thirsty', si: 'අධික පිපාසය', ta: 'அதிக தாகம்' } },
  { key: 'urination', severity: 'minor', label: { en: 'Frequent urination', si: 'නිතර මුත්‍රා කිරීම', ta: 'அடிக்கடி சிறுநீர்' } },
  { key: 'tiredness', severity: 'minor', label: { en: 'Tiredness', si: 'මහන්සිය', ta: 'சோர்வு' } },
]

export const SYMPTOMS = Object.fromEntries(SYMPTOM_LIST.map((s) => [s.key, s])) as Record<SymptomKey, SymptomDef>

/** Symptoms that make a low glucose reading urgent. */
export const HYPO_SYMPTOMS: SymptomKey[] = ['sweating', 'confusion', 'dizziness', 'fainting']
/** Symptoms that make a very high glucose reading urgent. */
export const HYPER_SYMPTOMS: SymptomKey[] = ['thirst', 'urination', 'vomiting', 'confusion']

export function symptomLabel(key: SymptomKey, lang: Lang = 'en'): string {
  return SYMPTOMS[key]?.label[lang] ?? key
}

export function symptomList(keys: SymptomKey[], lang: Lang = 'en'): string {
  const labels = keys.map((k) => symptomLabel(k, lang))
  if (lang !== 'en') return labels.join(', ')
  const lower = labels.map((l) => l.toLowerCase())
  if (lower.length <= 1) return lower.join('')
  return `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}`
}

export const CONDITION_LABEL: Record<Condition, Record<Lang, string>> = {
  diabetes: { en: 'Diabetes', si: 'දියවැඩියාව', ta: 'நீரிழிவு' },
  hypertension: { en: 'Hypertension', si: 'අධි රුධිර පීඩනය', ta: 'உயர் இரத்த அழுத்தம்' },
}

export const LANG_NAME: Record<Lang, string> = { en: 'English', si: 'සිංහල', ta: 'தமிழ்' }
