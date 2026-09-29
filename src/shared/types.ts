export type Band = 'red' | 'amber' | 'green'
export type Lang = 'en' | 'si' | 'ta'
export type Condition = 'diabetes' | 'hypertension'
export type Sex = 'F' | 'M'
export type GlucoseType = 'fasting' | 'random'
export type Theme = 'night' | 'day'
export type DecisionAction = 'continue' | 'review' | 'refer' | 'protocol'

export type SymptomKey =
  | 'chest_pain'
  | 'breathless'
  | 'weakness'
  | 'confusion'
  | 'fainting'
  | 'dizziness'
  | 'headache'
  | 'blurred_vision'
  | 'vomiting'
  | 'sweating'
  | 'foot_wound'
  | 'swelling'
  | 'thirst'
  | 'urination'
  | 'tiredness'

export interface Patient {
  id: string
  code: string
  cardId: string
  name: string
  age: number
  sex: Sex
  lang: Lang
  phone: string | null
  phoneType: 'smart' | 'basic' | null
  nic: string | null
  area: string
  conditions: Condition[]
  consentAt: string
  registeredBy: string
  createdAt: string
  syncedAt: string | null
}

export interface Reading {
  id: string
  patientId: string
  takenAt: string
  sys: number | null
  dia: number | null
  glucose: number | null
  glucoseType: GlucoseType
  symptoms: SymptomKey[]
  missedDays: number
  notes: string
  source: 'worker' | 'self'
  enteredBy: string
  deviceId: string
  syncedAt: string | null
}

export interface OutboundMessage {
  channel: 'sms' | 'print'
  lang: Lang
  text: string
  to: string | null
  status: 'queued' | 'sent' | 'delivered'
}

export interface Decision {
  id: string
  patientId: string
  readingId: string | null
  action: DecisionAction
  scheduledFor: string | null
  note: string
  decidedBy: string
  decidedAt: string
  band: Band
  message: OutboundMessage
  bulk: boolean
}

export type ReasonCode =
  | 'bp_severe'
  | 'bp_grade2'
  | 'bp_above'
  | 'bp_low'
  | 'bp_low_symptoms'
  | 'gl_very_high'
  | 'gl_high_symptoms'
  | 'gl_above'
  | 'gl_low'
  | 'gl_low_severe'
  | 'gl_low_symptoms'
  | 'sym_urgent'
  | 'sym_warning'
  | 'sym_warning_combo'
  | 'sym_watch'
  | 'med_missed'
  | 'med_missed_uncontrolled'
  | 'trend_bp'
  | 'trend_gl'
  | 'in_target'
  | 'no_glucose'

export interface TriageReason {
  code: ReasonCode
  band: Band | 'info'
  params?: Record<string, string | number>
}

export interface Trend {
  direction: 'up' | 'down' | 'flat' | 'none'
  sysDelta: number | null
  glucoseDelta: number | null
}

export interface TriageResult {
  band: Band
  score: number
  reasons: TriageReason[]
  trend: Trend
}

export type ReadingInput = Pick<
  Reading,
  'sys' | 'dia' | 'glucose' | 'glucoseType' | 'symptoms' | 'missedDays' | 'takenAt'
>

/* ------------------------------------------------------------------ */
/* Clinic (portal) side                                                */
/* ------------------------------------------------------------------ */

export interface ClinicInfo {
  name: string
  doctor: string
  hospital: string
}

export interface Device {
  id: string
  name: string
  worker: string
  division: string
  secret: string
  lastSyncAt: string | null
}

export type AuditKind = 'open' | 'scan' | 'decision' | 'bulk' | 'sync' | 'pair' | 'portal'

export interface AuditEvent {
  id: string
  at: string
  actor: string
  kind: AuditKind
  patientId?: string
  detail: string
  count?: number
}

export interface PatientSummary {
  id: string
  code: string
  cardId: string
  name: string
  age: number
  sex: Sex
  area: string
  lang: Lang
  conditions: Condition[]
  phoneType: Patient['phoneType']
  latest: {
    readingId: string
    takenAt: string
    sys: number | null
    dia: number | null
    glucose: number | null
    glucoseType: GlucoseType
    symptoms: SymptomKey[]
    missedDays: number
    enteredBy: string
    source: Reading['source']
  } | null
  triage: TriageResult | null
  awaiting: boolean
  lastDecision: { action: DecisionAction; decidedAt: string; decidedBy: string } | null
  receivedAt: string | null
  readingCount: number
}

export interface PatientDetail {
  patient: Omit<Patient, 'nic'> & { nicMasked: string | null; phoneMasked: string | null }
  summary: PatientSummary
  readings: Reading[]
  decisions: Decision[]
  access: AuditEvent[]
}

export interface ClinicStats {
  awaiting: Record<Band, number>
  totalPatients: number
  reviewedToday: number
  tripsAvoided: number
  messagesToday: number
}

export interface Bootstrap {
  clinic: ClinicInfo
  summaries: PatientSummary[]
  stats: ClinicStats
  rulesVersion: string
  serverTime: string
}

/* ------------------------------------------------------------------ */
/* Sync protocol                                                       */
/* ------------------------------------------------------------------ */

export interface SyncRequest {
  deviceId: string
  since: string | null
  patients: Patient[]
  readings: Reading[]
}

export interface SyncResponse {
  accepted: { patients: string[]; readings: string[] }
  decisions: Decision[]
  serverTime: string
}

/* ------------------------------------------------------------------ */
/* Field (desktop) side                                                */
/* ------------------------------------------------------------------ */

export interface FieldDevice {
  id: string
  name: string
  workerName: string
  workerRole: string
  division: string
  secret: string
}

export interface SyncLogEntry {
  id: string
  at: string
  ok: boolean
  sent: number
  received: number
  ms: number
  error?: string
}

export interface FieldSettings {
  lang: Lang
  theme: Theme
  autoSync: boolean
  /** Start the clinic portal automatically when the app opens (handy for demos). */
  portalOnLaunch?: boolean
}

export interface FieldState {
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

export type SyncPhase = 'idle' | 'syncing' | 'done' | 'error'

export interface SyncStatus {
  phase: SyncPhase
  total: number
  sent: number
  error: string | null
  lastResult: SyncLogEntry | null
}

export interface PortalStatus {
  running: boolean
  port: number | null
  lan: boolean
  localUrl: string | null
  lanUrl: string | null
  pairCode: string | null
  /** localUrl + one-tap pairing code (for "Open in browser") */
  pairUrl: string | null
  /** lanUrl + one-tap pairing code (for the QR code) */
  lanPairUrl: string | null
  viewers: number
  startedAt: string | null
}

export interface RequestLogEntry {
  id: number
  t: number
  method: string
  path: string
  status: number
  ms: number
}

export interface NewPatientInput {
  name: string
  age: number
  sex: Sex
  lang: Lang
  phone: string | null
  phoneType: Patient['phoneType']
  nic: string | null
  area: string
  conditions: Condition[]
}

export interface NewReadingInput {
  patientId: string
  sys: number | null
  dia: number | null
  glucose: number | null
  glucoseType: GlucoseType
  symptoms: SymptomKey[]
  missedDays: number
  notes: string
}
