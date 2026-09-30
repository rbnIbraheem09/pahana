import { DAY_MS } from './format'
import { composeMessage, DEFAULT_CLINIC, suggestedDate } from './messages'
import { cardIdFrom, createRng, type Rng } from './random'
import { triage } from './triage'
import type {
  AuditEvent,
  Band,
  ClinicInfo,
  Condition,
  Decision,
  DecisionAction,
  Device,
  FieldDevice,
  FieldSettings,
  GlucoseType,
  Lang,
  Patient,
  Reading,
  Sex,
  SymptomKey,
  SyncLogEntry,
} from './types'

export interface ClinicDB {
  version: 1
  clinic: ClinicInfo
  patients: Patient[]
  readings: Reading[]
  decisions: Decision[]
  audit: AuditEvent[]
  devices: Device[]
  seededAt: string
  /** true until anything changes the demo (used to refresh stale demo data on launch) */
  pristine?: boolean
}

export interface FieldDB {
  version: 1
  device: FieldDevice
  clinic: ClinicInfo
  online: boolean
  patients: Patient[]
  readings: Reading[]
  decisions: Decision[]
  syncLog: SyncLogEntry[]
  lastSyncAt: string | null
  settings: FieldSettings
  seededAt: string
  pristine?: boolean
}

/* ------------------------------------------------------------------ */
/* Name pools                                                          */
/* ------------------------------------------------------------------ */

const TAMIL_F = ['Muthulakshmi', 'Selvi', 'Pushpa', 'Letchumi', 'Parvathy', 'Vasanthi', 'Kamala', 'Saraswathy', 'Jeyaletchumi', 'Mariyamma', 'Rajeswari', 'Thangamma', 'Vijaya', 'Santhi', 'Malar', 'Meenakshi', 'Nageswari', 'Pathmini', 'Kalaivani', 'Sivagami', 'Chandra', 'Devi', 'Annamma', 'Rani']
const TAMIL_M = ['Selvaraj', 'Muthusamy', 'Ramasamy', 'Krishnan', 'Subramaniam', 'Velusamy', 'Arumugam', 'Murugan', 'Ganesan', 'Palaniyandi', 'Rajendran', 'Sinnathamby', 'Periyasamy', 'Kandasamy', 'Thangaraj', 'Sivakumar', 'Ravi', 'Anthony', 'Joseph', 'Raman', 'Sellaiah', 'Karuppiah', 'Mariyappan', 'Veerappan']
const SINHALA_F = ['Kusumawathi', 'Sunethra', 'Chandrika', 'Nirmala', 'Swarna', 'Dayawathi', 'Sriyani', 'Anoma', 'Padma', 'Somawathi', 'Indrani', 'Malani', 'Wimala', 'Seelawathi', 'Dilani', 'Kanthi', 'Ramya', 'Chandra']
const SINHALA_M = ['Sunil', 'Premadasa', 'Gunapala', 'Wijesiri', 'Nimal', 'Ranjith', 'Sarath', 'Upali', 'Jayasena', 'Piyadasa', 'Chaminda', 'Ajith', 'Lalith', 'Tikiri', 'Bandula', 'Asoka', 'Kamal', 'Sumith']
const SINHALA_SUR = ['Perera', 'Wijesinghe', 'Herath', 'Rathnayake', 'Bandara', 'Jayasinghe', 'Dissanayake', 'Senanayake', 'Gunasekara', 'Kumara', 'Fernando', 'Silva', 'Wickramasinghe', 'Ekanayake', 'Abeysinghe', 'Karunaratne', 'Weerasinghe', 'Tennakoon', 'Madushanka', 'Rajapakse']
const MUSLIM_F = ['Fathima', 'Rizana', 'Farzana', 'Nuzrath', 'Sithy', 'Hameedha', 'Rinoza', 'Safna']
const MUSLIM_M = ['Mohamed', 'Rizwan', 'Faizal', 'Ansar', 'Nazeer', 'Hameed', 'Ismail', 'Rafeek']
const MUSLIM_SUR = ['Nazeer', 'Hameed', 'Ismail', 'Farook', 'Cassim', 'Marikar', 'Lebbe', 'Razik']

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

interface DeviceSeed {
  id: string
  name: string
  worker: string
  role: string
  division: string
  areas: string[]
}

const FIELD_DEVICE: DeviceSeed = {
  id: 'dev-dickoya-01',
  name: 'Dickoya field laptop',
  worker: 'S. Mahendran',
  role: 'Estate Medical Assistant',
  division: 'Dickoya',
  areas: ['Dickoya', 'Dunkeld', 'Glencairn'],
}

const OTHER_DEVICES: DeviceSeed[] = [
  { id: 'dev-norwood-02', name: 'Norwood PHM tablet', worker: 'R. Thilagavathy', role: 'Public Health Midwife', division: 'Norwood', areas: ['Norwood', 'Bogawantalawa', 'Lethenty'] },
  { id: 'dev-maskeliya-03', name: 'Maskeliya field laptop', worker: 'K. Jeyakumar', role: 'Estate Medical Assistant', division: 'Maskeliya', areas: ['Maskeliya', 'Moray', 'Brownlow'] },
  { id: 'dev-hatton-04', name: 'Hatton clinic desk', worker: 'Clinic desk', role: 'Clinic staff', division: 'Hatton', areas: ['Hatton', 'Kotagala', 'Watagoda'] },
]

/* ------------------------------------------------------------------ */
/* Stories: how a target band is produced                              */
/* ------------------------------------------------------------------ */

type Story =
  | 'green'
  | 'bp_above'
  | 'bp_grade2'
  | 'gl_above'
  | 'missed'
  | 'watch'
  | 'warning_alone'
  | 'bp_severe'
  | 'combo'
  | 'gl_very_high'
  | 'hyper_sym'
  | 'urgent'
  | 'hypo'

const STORY_BAND: Record<Story, Band> = {
  green: 'green',
  bp_above: 'amber',
  bp_grade2: 'amber',
  gl_above: 'amber',
  missed: 'amber',
  watch: 'amber',
  warning_alone: 'amber',
  bp_severe: 'red',
  combo: 'red',
  gl_very_high: 'red',
  hyper_sym: 'red',
  urgent: 'red',
  hypo: 'red',
}

const NEEDS_DM: Story[] = ['gl_above', 'gl_very_high', 'hyper_sym', 'hypo']
const NEEDS_HTN: Story[] = ['bp_above', 'bp_grade2', 'bp_severe', 'combo']

const AMBER_MIX: Story[] = ['bp_above', 'bp_above', 'bp_above', 'gl_above', 'gl_above', 'bp_grade2', 'missed', 'watch', 'warning_alone']

interface Profile {
  htn: boolean
  dm: boolean
  sysBase: number
  diaBase: number
  gfBase: number
  grBase: number
}

interface Values {
  sys: number | null
  dia: number | null
  glucose: number | null
  glucoseType: GlucoseType
  symptoms: SymptomKey[]
  missedDays: number
}

const clampR = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)))

function targetValues(story: Story, p: Profile, rng: Rng): Values {
  const gType: GlucoseType = rng.chance(0.55) ? 'fasting' : 'random'
  const normalBp = () => ({ sys: clampR(rng.normal(127, 6), 108, 137), dia: clampR(rng.normal(80, 4), 66, 88) })
  const normalGl = (t: GlucoseType) =>
    p.dm ? (t === 'fasting' ? rng.int(90, 126) : rng.int(110, 172)) : rng.chance(0.25) ? rng.int(92, 150) : null
  const base = (): Values => {
    const bp = normalBp()
    return { ...bp, glucose: normalGl(gType), glucoseType: gType, symptoms: [], missedDays: 0 }
  }
  const v = base()
  switch (story) {
    case 'green':
      if (rng.chance(0.06)) v.symptoms = ['tiredness']
      if (rng.chance(0.12)) v.missedDays = 1
      break
    case 'bp_above':
      v.sys = rng.int(142, 158)
      v.dia = rng.int(84, 98)
      break
    case 'bp_grade2':
      v.sys = rng.int(160, 176)
      v.dia = rng.int(92, 106)
      break
    case 'gl_above':
      v.glucose = v.glucoseType === 'fasting' ? rng.int(136, 238) : rng.int(186, 244)
      if (rng.chance(0.3)) v.symptoms = ['thirst']
      break
    case 'missed':
      v.missedDays = rng.int(3, 5)
      break
    case 'watch':
      v.symptoms = [p.dm && rng.chance(0.6) ? 'foot_wound' : 'swelling']
      break
    case 'warning_alone':
      v.symptoms = [rng.pick(['headache', 'dizziness', 'blurred_vision'] as SymptomKey[])]
      v.sys = rng.int(128, 150)
      break
    case 'bp_severe':
      v.sys = rng.int(182, 204)
      v.dia = rng.int(104, 118)
      v.missedDays = rng.int(0, 3)
      break
    case 'combo':
      v.sys = rng.int(162, 176)
      v.dia = rng.int(98, 106)
      v.symptoms = [rng.pick(['dizziness', 'headache', 'blurred_vision'] as SymptomKey[])]
      v.missedDays = rng.int(1, 3)
      break
    case 'gl_very_high':
      v.glucose = v.glucoseType === 'fasting' ? rng.int(302, 336) : rng.int(310, 388)
      v.symptoms = rng.chance(0.5) ? ['tiredness'] : []
      break
    case 'hyper_sym':
      v.glucose = rng.int(256, 294)
      v.glucoseType = 'random'
      v.symptoms = ['thirst', 'urination']
      break
    case 'urgent':
      v.sys = rng.int(146, 166)
      v.dia = rng.int(88, 98)
      v.symptoms = [rng.pick(['chest_pain', 'breathless'] as SymptomKey[])]
      break
    case 'hypo':
      v.glucose = rng.int(52, 66)
      v.glucoseType = 'random'
      v.symptoms = ['sweating']
      break
  }
  if (!p.htn && v.sys != null && STORY_BAND[story] === 'green') {
    v.sys = clampR(rng.normal(121, 6), 104, 134)
    v.dia = clampR(rng.normal(77, 4), 64, 86)
  }
  return v
}

function pastValues(p: Profile, target: Values, progress: number, band: Band, rng: Rng): Values {
  // Earlier readings sit near baseline and drift toward today's values (more drift for worse bands).
  const drift = band === 'green' ? 0.85 : band === 'amber' ? 0.5 : 0.35
  const towards = (base: number, t: number | null) => (t == null ? base : base + (t - base) * drift * progress)
  const gType: GlucoseType = rng.chance(0.55) ? 'fasting' : 'random'
  const gBase = gType === 'fasting' ? p.gfBase : p.grBase
  const gTarget = target.glucose != null && target.glucoseType === gType ? target.glucose : null
  const glucose = p.dm
    ? clampR(towards(gBase, gTarget) + rng.normal(0, 9), 78, 280)
    : rng.chance(0.2)
      ? rng.int(90, 140)
      : null
  return {
    sys: clampR(towards(p.sysBase, target.sys) + rng.normal(0, 4), 100, 190),
    dia: clampR(towards(p.diaBase, target.dia) + rng.normal(0, 3), 60, 112),
    glucose,
    glucoseType: gType,
    symptoms: rng.chance(0.05) ? ['tiredness'] : [],
    missedDays: rng.chance(0.15) ? 1 : 0,
  }
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

interface PlanItem {
  group: 'today' | 'due' | 'other'
  story: Story
  device: DeviceSeed
  special?: boolean
}

export function generateDemo(nowMs = Date.now(), seed = 842): { clinic: ClinicDB; field: FieldDB } {
  const rng = createRng(seed)
  const iso = (t: number) => new Date(t).toISOString()
  const clinic = { ...DEFAULT_CLINIC }

  const fieldSecret = rng.hex(64)
  const devices: Device[] = [
    { id: FIELD_DEVICE.id, name: FIELD_DEVICE.name, worker: FIELD_DEVICE.worker, division: FIELD_DEVICE.division, secret: fieldSecret, lastSyncAt: null },
    ...OTHER_DEVICES.map((d) => ({ id: d.id, name: d.name, worker: d.worker, division: d.division, secret: rng.hex(64), lastSyncAt: null })),
  ]

  /* Plan: which patient gets which story */
  const plan: PlanItem[] = []
  // Field device: today's round (48 unsynced readings) → 3 red, 4 amber, 41 green
  plan.push({ group: 'today', story: 'combo', device: FIELD_DEVICE, special: true }) // Patient #0842
  plan.push({ group: 'today', story: 'bp_severe', device: FIELD_DEVICE })
  plan.push({ group: 'today', story: 'hyper_sym', device: FIELD_DEVICE })
  for (const s of ['bp_above', 'gl_above', 'missed', 'bp_grade2'] as Story[]) plan.push({ group: 'today', story: s, device: FIELD_DEVICE })
  for (let i = 0; i < 41; i++) plan.push({ group: 'today', story: 'green', device: FIELD_DEVICE })
  // Field device: caseload not seen today (already reviewed)
  for (let i = 0; i < 12; i++) plan.push({ group: 'due', story: 'green', device: FIELD_DEVICE })
  // Other devices: already in the clinic queue → 5 red, 27 amber, 386 green
  const otherStories: Story[] = [
    'bp_severe', 'gl_very_high', 'combo', 'urgent', 'hypo',
    ...Array.from({ length: 27 }, (_, i) => AMBER_MIX[i % AMBER_MIX.length]),
    ...Array.from({ length: 386 }, () => 'green' as Story),
  ]
  otherStories.forEach((story, i) => plan.push({ group: 'other', story, device: OTHER_DEVICES[i % OTHER_DEVICES.length] }))

  /* Unique 4-digit codes; #0842 reserved for the mockup patient */
  const codes = rng.shuffle(Array.from({ length: 1900 }, (_, i) => String(i + 100).padStart(4, '0')).filter((c) => c !== '0842'))

  const patients: Patient[] = []
  const readings: Reading[] = []
  const decisions: Decision[] = []
  const fieldPatientIds = new Set<string>()
  const unsyncedReadingIds = new Set<string>()

  // today's round: spread over the last ~5.5 hours, newest last
  const todayTimes = Array.from({ length: 48 }, (_, i) => nowMs - (5.5 * 3600_000 * (48 - i)) / 48 - rng.int(2, 9) * 60_000)
  const specialTodayIdx = 44 // about 40 minutes ago
  const todaySlots = todayTimes.map((_, i) => i).filter((i) => i !== specialTodayIdx)
  let todayIdx = 0

  for (const item of plan) {
    const { story, device } = item
    const band = STORY_BAND[story]

    /* Identity */
    const eth = rng.next()
    const sex: Sex = rng.chance(0.55) ? 'F' : 'M'
    let name: string
    let lang: Lang
    if (eth < 0.62) {
      name = `${rng.pick(sex === 'F' ? TAMIL_F : TAMIL_M)} ${rng.pick(TAMIL_M)}`
      lang = 'ta'
    } else if (eth < 0.92) {
      name = `${rng.pick(sex === 'F' ? SINHALA_F : SINHALA_M)} ${rng.pick(SINHALA_SUR)}`
      lang = rng.chance(0.06) ? 'en' : 'si'
    } else {
      name = `${rng.pick(sex === 'F' ? MUSLIM_F : MUSLIM_M)} ${rng.pick(MUSLIM_SUR)}`
      lang = rng.chance(0.7) ? 'ta' : 'si'
    }
    let age = clampR(rng.normal(58, 9), 38, 81)

    /* Conditions */
    const roll = rng.next()
    let htn = roll < 0.75
    let dm = roll > 0.35
    if (NEEDS_DM.includes(story)) dm = true
    if (NEEDS_HTN.includes(story)) htn = true
    if (!htn && !dm) htn = true

    const phoneType: Patient['phoneType'] = rng.chance(0.1) ? null : rng.chance(0.5) ? 'smart' : 'basic'
    let code = codes.pop()!
    if (item.special) {
      name = 'Muthulakshmi Ramasamy'
      lang = 'ta'
      age = 54
      htn = true
      dm = true
      code = '0842'
    }
    const conditions: Condition[] = [...(htn ? (['hypertension'] as const) : []), ...(dm ? (['diabetes'] as const) : [])]
    const createdAt = nowMs - rng.int(200, 900) * DAY_MS
    const patient: Patient = {
      id: `pt-${rng.hex(12)}`,
      code,
      cardId: cardIdFrom(rng.next),
      name,
      age,
      sex: item.special ? 'F' : sex,
      lang,
      phone: phoneType || item.special ? `+94 7${rng.pick([0, 1, 2, 4, 5, 6, 7, 8])} ${rng.int(100, 999)} ${rng.int(1000, 9999)}` : null,
      phoneType: item.special ? 'basic' : phoneType,
      nic: rng.chance(0.65) ? `${1945 + (81 - age)}${String(rng.int(1, 365) + (sex === 'F' ? 500 : 0)).padStart(3, '0')}${rng.int(1000, 9999)}${rng.int(0, 9)}` : null,
      area: rng.pick(device.areas),
      conditions,
      consentAt: iso(createdAt),
      registeredBy: device.worker,
      createdAt: iso(createdAt),
      syncedAt: iso(createdAt + 3600_000),
    }
    patients.push(patient)
    if (device === FIELD_DEVICE) fieldPatientIds.add(patient.id)

    /* Profile + target reading, verified against the engine */
    const profile: Profile = {
      htn,
      dm,
      sysBase: htn ? rng.normal(134, 6) : rng.normal(120, 5),
      diaBase: htn ? rng.normal(84, 4) : rng.normal(76, 3),
      gfBase: dm ? rng.normal(118, 8) : 95,
      grBase: dm ? rng.normal(152, 12) : 120,
    }

    let latestAt: number
    if (item.group === 'today') {
      latestAt = todayTimes[item.special ? specialTodayIdx : todaySlots[todayIdx++]]
    } else if (item.group === 'due') {
      latestAt = nowMs - rng.int(26, 70) * DAY_MS - rng.int(1, 8) * 3600_000
    } else {
      latestAt = nowMs - rng.int(2, 220) * 3600_000 - rng.int(0, 59) * 60_000
    }
    const pastCount = item.special ? 4 : rng.int(3, 7)
    const spacing = rng.int(24, 34) * DAY_MS
    const pastTimes = Array.from({ length: pastCount }, (_, i) => latestAt - spacing * (pastCount - i) + rng.int(-3, 3) * DAY_MS)

    let target: Values
    let past: Values[]
    let attempts = 0
    for (;;) {
      target = item.special
        ? { sys: 168, dia: 102, glucose: 140, glucoseType: 'random', symptoms: ['dizziness'], missedDays: 2 }
        : targetValues(story, profile, rng)
      past = item.special
        ? [
            { sys: 142, dia: 90, glucose: 150, glucoseType: 'random', symptoms: [], missedDays: 0 },
            { sys: 148, dia: 92, glucose: 138, glucoseType: 'random', symptoms: [], missedDays: 0 },
            { sys: 152, dia: 96, glucose: 145, glucoseType: 'random', symptoms: [], missedDays: 1 },
            { sys: 158, dia: 98, glucose: 132, glucoseType: 'random', symptoms: [], missedDays: 0 },
          ]
        : pastTimes.map((_, i) => pastValues(profile, target, (i + 1) / (pastCount + 1), band, rng))
      const history = past.map((v, i) => ({ id: `h${i}`, takenAt: iso(pastTimes[pastTimes.length - past.length + i]), ...v }))
      const got = triage({ ...target, takenAt: iso(latestAt) }, { history, conditions }).band
      if (got === band || ++attempts > 60) break
    }

    const workerFor = (d: DeviceSeed) => d.worker
    const pastTimesUsed = pastTimes.slice(pastTimes.length - past.length)
    const patientReadings: Reading[] = []
    past.forEach((v, i) => {
      const r: Reading = {
        id: `rd-${rng.hex(12)}`,
        patientId: patient.id,
        takenAt: iso(pastTimesUsed[i]),
        ...v,
        notes: '',
        source: 'worker',
        enteredBy: workerFor(device),
        deviceId: device.id,
        syncedAt: iso(pastTimesUsed[i] + rng.int(1, 30) * 3600_000),
      }
      patientReadings.push(r)
    })
    const latest: Reading = {
      id: `rd-${rng.hex(12)}`,
      patientId: patient.id,
      takenAt: iso(latestAt),
      ...target,
      notes: item.special ? 'Says she feels dizzy when standing up after work.' : '',
      source: 'worker',
      enteredBy: workerFor(device),
      deviceId: device.id,
      syncedAt: item.group === 'today' ? null : iso(latestAt + rng.int(1, 5) * 3600_000),
    }
    patientReadings.push(latest)
    readings.push(...patientReadings)
    if (item.group === 'today') unsyncedReadingIds.add(latest.id)

    /* Decisions for every reading that has already been reviewed */
    const decided = item.group === 'other' ? patientReadings.slice(0, -1) : item.group === 'today' ? patientReadings.slice(0, -1) : patientReadings
    decided.forEach((r, i) => {
      const history = patientReadings.slice(0, patientReadings.indexOf(r))
      const t = triage(r, { history, conditions, readingId: r.id })
      let action: DecisionAction = 'continue'
      if (!item.special) {
        if (t.band === 'red') action = rng.chance(0.6) ? 'refer' : 'review'
        else if (t.band === 'amber') action = rng.pick(['review', 'protocol', 'continue'] as DecisionAction[])
      }
      const decidedAtMs = Date.parse(r.takenAt) + rng.int(3, 40) * 3600_000
      const date = action === 'continue' ? null : suggestedDate(rng.int(2, 6), new Date(decidedAtMs))
      decisions.push({
        id: `dc-${rng.hex(12)}`,
        patientId: patient.id,
        readingId: r.id,
        action,
        scheduledFor: date,
        note: '',
        decidedBy: clinic.doctor,
        decidedAt: iso(decidedAtMs),
        band: t.band,
        message: {
          channel: patient.phone ? 'sms' : 'print',
          lang: patient.lang,
          text: composeMessage({ action, lang: patient.lang, date, clinic, worker: device.worker, now: new Date(decidedAtMs) }),
          to: patient.phone,
          status: 'delivered',
        },
        bulk: t.band === 'green' && i % 3 === 0,
      })
    })
  }

  /* Split into clinic + field views */
  const clinicReadings = readings.filter((r) => !unsyncedReadingIds.has(r.id))
  const lastFieldSync = startOfYesterdayEvening(nowMs)

  const audit: AuditEvent[] = []
  const pushAudit = (at: number, kind: AuditEvent['kind'], actor: string, detail: string, count?: number) =>
    audit.push({ id: `ev-${rng.hex(10)}`, at: iso(at), actor, kind, detail, count })
  for (const d of OTHER_DEVICES) {
    pushAudit(nowMs - rng.int(20, 30) * 3600_000, 'sync', d.worker, `${d.name} synced records`, rng.int(40, 90))
    pushAudit(nowMs - rng.int(1, 9) * 3600_000, 'sync', d.worker, `${d.name} synced records`, rng.int(20, 60))
  }
  pushAudit(lastFieldSync, 'sync', FIELD_DEVICE.worker, `${FIELD_DEVICE.name} synced records`, 31)
  audit.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const seededAt = iso(nowMs)
  const clinicDb: ClinicDB = {
    version: 1,
    clinic,
    patients,
    readings: clinicReadings,
    decisions,
    audit,
    devices: devices.map((d) => (d.id === FIELD_DEVICE.id ? { ...d, lastSyncAt: iso(lastFieldSync) } : d)),
    seededAt,
    pristine: true,
  }

  const fieldDb: FieldDB = {
    version: 1,
    device: {
      id: FIELD_DEVICE.id,
      name: FIELD_DEVICE.name,
      workerName: FIELD_DEVICE.worker,
      workerRole: FIELD_DEVICE.role,
      division: FIELD_DEVICE.division,
      secret: fieldSecret,
    },
    clinic,
    online: false,
    patients: patients.filter((p) => fieldPatientIds.has(p.id)),
    readings: readings.filter((r) => fieldPatientIds.has(r.patientId)),
    decisions: decisions.filter((d) => fieldPatientIds.has(d.patientId)),
    syncLog: [{ id: `sl-${rng.hex(8)}`, at: iso(lastFieldSync), ok: true, sent: 31, received: 6, ms: 184 }],
    lastSyncAt: iso(lastFieldSync),
    settings: { lang: 'en', theme: 'day', autoSync: true },
    seededAt,
    pristine: true,
  }

  return { clinic: clinicDb, field: fieldDb }
}

function startOfYesterdayEvening(nowMs: number): number {
  const d = new Date(nowMs - DAY_MS)
  d.setHours(17, 42, 0, 0)
  return d.getTime()
}
