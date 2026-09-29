import { symptomList } from './symptoms'
import type { Lang, ReasonCode, SymptomKey, TriageReason } from './types'

type Templates = Record<ReasonCode, string>

const EN: Templates = {
  bp_severe: 'BP {sys}/{dia}, severe range (≥180/110)',
  bp_grade2: 'BP {sys}/{dia}, above 160/100',
  bp_above: 'BP {sys}/{dia}, above target of 140/90',
  bp_low: 'BP {sys}/{dia}, low (systolic under 90)',
  bp_low_symptoms: 'Low BP ({sys}/{dia}) with {symptoms}',
  gl_very_high: 'Glucose {glucose} mg/dL, very high (≥300)',
  gl_high_symptoms: 'Glucose {glucose} mg/dL with {symptoms}',
  gl_above: '{type} {glucose} mg/dL, above target of {target}',
  gl_low: 'Glucose {glucose} mg/dL, low (under 70)',
  gl_low_severe: 'Glucose {glucose} mg/dL, dangerously low (under 54)',
  gl_low_symptoms: 'Low glucose ({glucose}) with {symptoms}',
  sym_urgent: 'Urgent symptom: {symptoms}',
  sym_warning: 'Reports {symptoms}',
  sym_warning_combo: '{Symptoms} with {context}',
  sym_watch: 'Needs checking: {symptoms}',
  med_missed: 'Missed medication {days} of the last 7 days',
  med_missed_uncontrolled: 'Missed medication {days} {dayWord} while above target',
  trend_bp: 'BP rising, +{delta} mmHg systolic vs recent visits',
  trend_gl: 'Glucose rising, +{delta} mg/dL vs recent visits',
  in_target: 'Readings within target, no warning symptoms',
  no_glucose: 'Glucose not recorded for a diabetic patient',
}

const SI: Templates = {
  bp_severe: 'රුධිර පීඩනය {sys}/{dia}, ඉතා ඉහළයි (≥180/110)',
  bp_grade2: 'රුධිර පීඩනය {sys}/{dia}, 160/100 ට වඩා වැඩියි',
  bp_above: 'රුධිර පීඩනය {sys}/{dia}, ඉලක්කය (140/90) ඉක්මවයි',
  bp_low: 'රුධිර පීඩනය {sys}/{dia}, අඩුයි (90 ට අඩු)',
  bp_low_symptoms: 'අඩු රුධිර පීඩනය ({sys}/{dia}) සමඟ {symptoms}',
  gl_very_high: 'සීනි {glucose} mg/dL, ඉතා ඉහළයි (≥300)',
  gl_high_symptoms: 'සීනි {glucose} mg/dL සමඟ {symptoms}',
  gl_above: '{type} {glucose} mg/dL, ඉලක්කය ({target}) ඉක්මවයි',
  gl_low: 'සීනි {glucose} mg/dL, අඩුයි (70 ට අඩු)',
  gl_low_severe: 'සීනි {glucose} mg/dL, භයානක ලෙස අඩුයි (54 ට අඩු)',
  gl_low_symptoms: 'අඩු සීනි ({glucose}) සමඟ {symptoms}',
  sym_urgent: 'හදිසි රෝග ලක්ෂණය: {symptoms}',
  sym_warning: 'රෝග ලක්ෂණය: {symptoms}',
  sym_warning_combo: '{symptoms} සහ {context}',
  sym_watch: 'පරීක්ෂා කළ යුතුයි: {symptoms}',
  med_missed: 'පසුගිය දින 7 න් දින {days} ක් ඖෂධ මඟ හැරී ඇත',
  med_missed_uncontrolled: 'ඉලක්කය ඉක්මවා සිටියදී දින {days} ක් ඖෂධ මඟ හැරී ඇත',
  trend_bp: 'රුධිර පීඩනය ඉහළ යයි, මෑත පරීක්ෂණවලට වඩා +{delta} mmHg',
  trend_gl: 'සීනි ඉහළ යයි, මෑත පරීක්ෂණවලට වඩා +{delta} mg/dL',
  in_target: 'කියවීම් ඉලක්කය තුළ, අනතුරු ලක්ෂණ නැත',
  no_glucose: 'දියවැඩියා රෝගියාගේ සීනි මැන නැත',
}

const TA: Templates = {
  bp_severe: 'இரத்த அழுத்தம் {sys}/{dia}, மிக அதிகம் (≥180/110)',
  bp_grade2: 'இரத்த அழுத்தம் {sys}/{dia}, 160/100 ஐ விட அதிகம்',
  bp_above: 'இரத்த அழுத்தம் {sys}/{dia}, இலக்கு 140/90 ஐ விட அதிகம்',
  bp_low: 'இரத்த அழுத்தம் {sys}/{dia}, குறைவு (90 க்குக் கீழ்)',
  bp_low_symptoms: 'குறைந்த இரத்த அழுத்தம் ({sys}/{dia}) உடன் {symptoms}',
  gl_very_high: 'சர்க்கரை {glucose} mg/dL, மிக அதிகம் (≥300)',
  gl_high_symptoms: 'சர்க்கரை {glucose} mg/dL உடன் {symptoms}',
  gl_above: '{type} {glucose} mg/dL, இலக்கு {target} ஐ விட அதிகம்',
  gl_low: 'சர்க்கரை {glucose} mg/dL, குறைவு (70 க்குக் கீழ்)',
  gl_low_severe: 'சர்க்கரை {glucose} mg/dL, ஆபத்தான அளவு குறைவு (54 க்குக் கீழ்)',
  gl_low_symptoms: 'குறைந்த சர்க்கரை ({glucose}) உடன் {symptoms}',
  sym_urgent: 'அவசர அறிகுறி: {symptoms}',
  sym_warning: 'அறிகுறி: {symptoms}',
  sym_warning_combo: '{symptoms} மற்றும் {context}',
  sym_watch: 'பரிசோதிக்க வேண்டும்: {symptoms}',
  med_missed: 'கடந்த 7 நாட்களில் {days} நாட்கள் மருந்து தவறியது',
  med_missed_uncontrolled: 'இலக்கை மீறிய நிலையில் {days} நாட்கள் மருந்து தவறியது',
  trend_bp: 'இரத்த அழுத்தம் உயர்கிறது, சமீபத்திய வருகைகளை விட +{delta} mmHg',
  trend_gl: 'சர்க்கரை உயர்கிறது, சமீபத்திய வருகைகளை விட +{delta} mg/dL',
  in_target: 'அளவீடுகள் இலக்கிற்குள், எச்சரிக்கை அறிகுறிகள் இல்லை',
  no_glucose: 'நீரிழிவு நோயாளியின் சர்க்கரை அளவிடப்படவில்லை',
}

const TEMPLATES: Record<Lang, Templates> = { en: EN, si: SI, ta: TA }

const CONTEXT: Record<Lang, Record<string, string>> = {
  en: { bp: 'BP above 160/100', high_glucose: 'glucose ≥250', low_glucose: 'low glucose' },
  si: { bp: 'ඉහළ රුධිර පීඩනය', high_glucose: 'ඉහළ සීනි', low_glucose: 'අඩු සීනි' },
  ta: { bp: 'உயர் இரத்த அழுத்தம்', high_glucose: 'அதிக சர்க்கரை', low_glucose: 'குறைந்த சர்க்கரை' },
}

export function formatReason(reason: TriageReason, lang: Lang = 'en'): string {
  const p = reason.params ?? {}
  const syms = typeof p.symptoms === 'string' && p.symptoms ? symptomList(p.symptoms.split(',') as SymptomKey[], lang) : ''
  const values: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    symptoms: syms,
    Symptoms: syms ? syms[0].toUpperCase() + syms.slice(1) : '',
    context: CONTEXT[lang][String(p.context ?? '')] ?? '',
    dayWord: Number(p.days) === 1 ? 'day' : 'days',
  }
  return TEMPLATES[lang][reason.code].replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')
}
