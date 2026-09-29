import { isoDate, longDate, parseIsoDate } from './format'
import type { ClinicInfo, DecisionAction, Lang } from './types'

export const DEFAULT_CLINIC: ClinicInfo = {
  name: 'Hatton Clinic',
  doctor: 'Dr. N. Perera',
  hospital: 'the Base Hospital',
}

const CLINIC_LOCAL: Record<Lang, string> = { en: 'Hatton Clinic', si: 'හැටන් සායනය', ta: 'ஹட்டன் கிளினிக்' }
const HOSPITAL_LOCAL: Record<Lang, string> = { en: 'the Base Hospital', si: 'මූලික රෝහල', ta: 'ஆதார வைத்தியசாலை' }

export const ACTIONS: DecisionAction[] = ['continue', 'review', 'refer', 'protocol']

export const ACTION_LABEL: Record<DecisionAction, Record<Lang, string>> = {
  continue: { en: 'Continue current plan', si: 'දැනට ඇති ප්‍රතිකාර දිගටම', ta: 'தற்போதைய சிகிச்சையைத் தொடரவும்' },
  review: { en: 'Request review', si: 'සායනයට කැඳවන්න', ta: 'பரிசோதனைக்கு அழைக்கவும்' },
  refer: { en: 'Refer', si: 'රෝහලට යොමු කරන්න', ta: 'வைத்தியசாலைக்குப் பரிந்துரை' },
  protocol: { en: 'Follow protocol', si: 'ප්‍රොටෝකෝලය අනුගමනය', ta: 'நெறிமுறையைப் பின்பற்றவும்' },
}

export const ACTION_HINT: Record<DecisionAction, string> = {
  continue: 'Stable. No trip needed',
  review: 'Patient comes to the clinic',
  refer: 'Send to hospital',
  protocol: 'Health worker adjusts per protocol',
}

/** Whether an action needs a date. */
export const ACTION_NEEDS_DATE: Record<DecisionAction, boolean> = {
  continue: false,
  review: true,
  refer: true,
  protocol: true,
}

const TEMPLATES: Record<Lang, Record<DecisionAction, string>> = {
  en: {
    continue:
      'Pahana: The clinic doctor has reviewed your check. Please continue your medicine as usual. You do not need to travel to the clinic now.',
    review: 'Pahana: Please come to {clinic} {when} for a review. Bring your clinic card.',
    refer: 'Pahana: Please go to {hospital} {when}. Show your clinic card at the counter.',
    protocol: 'Pahana: Your health worker {worker} will visit you {when} with instructions from the doctor.',
  },
  si: {
    continue:
      'පහන: සායනයේ වෛද්‍යවරයා ඔබගේ පරීක්ෂණය සලකා බැලුවා. කරුණාකර සුපුරුදු පරිදි ඔබගේ ඖෂධ දිගටම ගන්න. දැන් සායනයට පැමිණීමට අවශ්‍ය නැත.',
    review: 'පහන: කරුණාකර {when} පරීක්ෂාව සඳහා {clinic} වෙත පැමිණෙන්න. ඔබගේ සායන කාඩ්පත රැගෙන එන්න.',
    refer: 'පහන: කරුණාකර {when} {hospital} වෙත යන්න. ඔබගේ සායන කාඩ්පත කවුන්ටරයේ පෙන්වන්න.',
    protocol: 'පහන: ඔබගේ සෞඛ්‍ය සේවක {worker} {when} වෛද්‍ය උපදෙස් සමඟ ඔබව බැලීමට පැමිණේ.',
  },
  ta: {
    continue:
      'பஹன: கிளினிக் மருத்துவர் உங்கள் பரிசோதனையைப் பார்வையிட்டார். உங்கள் மருந்துகளை வழக்கம் போல் தொடர்ந்து எடுங்கள். இப்போது கிளினிக்கிற்கு வர வேண்டியதில்லை.',
    review: 'பஹன: {when} பரிசோதனைக்காக {clinic} இற்கு வாருங்கள். உங்கள் கிளினிக் அட்டையைக் கொண்டு வாருங்கள்.',
    refer: 'பஹன: {when} {hospital} இற்குச் செல்லுங்கள். உங்கள் கிளினிக் அட்டையைக் கருமபீடத்தில் காட்டுங்கள்.',
    protocol: 'பஹன: உங்கள் சுகாதார ஊழியர் {worker} {when} மருத்துவரின் அறிவுறுத்தல்களுடன் உங்களைச் சந்திப்பார்.',
  },
}

const TODAY: Record<Lang, string> = { en: 'today', si: 'අද', ta: 'இன்று' }
const TOMORROW: Record<Lang, string> = { en: 'tomorrow', si: 'හෙට', ta: 'நாளை' }

export function whenPhrase(date: string | null, lang: Lang, now = new Date()): string {
  if (!date) return TODAY[lang]
  const today = isoDate(now)
  const tmr = new Date(now)
  tmr.setDate(tmr.getDate() + 1)
  if (date === today) return TODAY[lang]
  if (date === isoDate(tmr)) return TOMORROW[lang]
  const long = longDate(parseIsoDate(date), lang)
  if (lang === 'si') return `${long} දින`
  if (lang === 'ta') return `${long} அன்று`
  return `on ${long}`
}

export interface MessageArgs {
  action: DecisionAction
  lang: Lang
  date: string | null
  clinic: ClinicInfo
  worker: string
  now?: Date
}

export function composeMessage({ action, lang, date, clinic, worker, now }: MessageArgs): string {
  const clinicName = clinic.name === DEFAULT_CLINIC.name ? CLINIC_LOCAL[lang] : clinic.name
  const hospital = clinic.hospital === DEFAULT_CLINIC.hospital ? HOSPITAL_LOCAL[lang] : clinic.hospital
  const values: Record<string, string> = {
    clinic: clinicName,
    hospital,
    worker,
    when: whenPhrase(date, lang, now),
  }
  return TEMPLATES[lang][action].replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')
}

/** Next working day at or after `days` from now (skips Sunday). */
export function suggestedDate(days: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return isoDate(d)
}
