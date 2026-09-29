import { randomBytes, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { maskNic, maskPhone, startOfDay } from '@shared/format'
import { ACTION_NEEDS_DATE, composeMessage, suggestedDate } from '@shared/messages'
import type { ClinicDB } from '@shared/seed'
import { comparePriority, RULES_VERSION, triage } from '@shared/triage'
import type {
  AuditEvent,
  AuditKind,
  Band,
  Bootstrap,
  ClinicStats,
  Decision,
  DecisionAction,
  Patient,
  PatientDetail,
  PatientSummary,
  Reading,
  SyncRequest,
  SyncResponse,
} from '@shared/types'
import { JsonFile } from '../lib/jsonFile'

export interface DecideInput {
  patientId: string
  action: DecisionAction
  scheduledFor?: string | null
  note?: string
}

type ClinicEvents = {
  summaries: [PatientSummary[]]
  activity: [AuditEvent]
  stats: [ClinicStats]
  reset: []
}

/**
 * The clinic's system of record. In production this would be a server;
 * in the prototype it lives in the app's main process and is exposed over HTTP.
 */
export class ClinicStore extends EventEmitter<ClinicEvents> {
  private db!: ClinicDB
  private readingsBy = new Map<string, Reading[]>()
  private decisionsBy = new Map<string, Decision[]>()
  private patientsById = new Map<string, Patient>()
  private byCard = new Map<string, string>()
  private summaryCache = new Map<string, PatientSummary>()

  constructor(private readonly file: JsonFile<ClinicDB>) {
    super()
  }

  load(fallback: () => ClinicDB): void {
    this.db = this.file.read() ?? fallback()
    this.reindex()
    this.persist()
  }

  replace(db: ClinicDB): void {
    this.db = db
    this.reindex()
    this.persist()
    this.emit('reset')
  }

  get clinic() {
    return this.db.clinic
  }

  get devices() {
    return this.db.devices
  }

  flush(): void {
    this.file.flush()
  }

  /* ---------------------------------------------------------------- */
  /* Reads                                                             */
  /* ---------------------------------------------------------------- */

  bootstrap(): Bootstrap {
    return {
      clinic: this.db.clinic,
      summaries: this.allSummaries(),
      stats: this.stats(),
      rulesVersion: RULES_VERSION,
      serverTime: new Date().toISOString(),
    }
  }

  allSummaries(): PatientSummary[] {
    return this.db.patients.map((p) => this.summary(p.id)!).sort(sortSummaries)
  }

  summary(patientId: string): PatientSummary | null {
    const cached = this.summaryCache.get(patientId)
    if (cached) return cached
    const p = this.patientsById.get(patientId)
    if (!p) return null
    const readings = this.readingsBy.get(p.id) ?? []
    const decisions = this.decisionsBy.get(p.id) ?? []
    const latest = readings[readings.length - 1] ?? null
    const t = latest ? triage(latest, { history: readings.slice(0, -1), conditions: p.conditions, readingId: latest.id }) : null
    const lastDecision = decisions[decisions.length - 1] ?? null
    const s: PatientSummary = {
      id: p.id,
      code: p.code,
      cardId: p.cardId,
      name: p.name,
      age: p.age,
      sex: p.sex,
      area: p.area,
      lang: p.lang,
      conditions: p.conditions,
      phoneType: p.phoneType,
      latest: latest
        ? {
            readingId: latest.id,
            takenAt: latest.takenAt,
            sys: latest.sys,
            dia: latest.dia,
            glucose: latest.glucose,
            glucoseType: latest.glucoseType,
            symptoms: latest.symptoms,
            missedDays: latest.missedDays,
            enteredBy: latest.enteredBy,
            source: latest.source,
          }
        : null,
      triage: t,
      awaiting: !!latest && !decisions.some((d) => d.readingId === latest.id),
      lastDecision: lastDecision
        ? { action: lastDecision.action, decidedAt: lastDecision.decidedAt, decidedBy: lastDecision.decidedBy }
        : null,
      receivedAt: latest?.syncedAt ?? null,
      readingCount: readings.length,
    }
    this.summaryCache.set(p.id, s)
    return s
  }

  detail(patientId: string, actor: string, via: 'queue' | 'scan' | 'search'): PatientDetail | null {
    const p = this.patientsById.get(patientId)
    if (!p) return null
    const s = this.summary(patientId)!
    this.audit(
      via === 'scan' ? 'scan' : 'open',
      actor,
      via === 'scan' ? `Opened #${p.code} by scanning clinic card` : `Opened #${p.code} from the ${via}`,
      p.id,
    )
    const { nic, ...rest } = p
    return {
      patient: { ...rest, nicMasked: maskNic(nic), phoneMasked: maskPhone(p.phone) },
      summary: s,
      readings: (this.readingsBy.get(p.id) ?? []).slice().reverse(),
      decisions: (this.decisionsBy.get(p.id) ?? []).slice().reverse(),
      access: this.db.audit.filter((e) => e.patientId === p.id).slice(0, 12),
    }
  }

  lookupCard(cardId: string): string | null {
    return this.byCard.get(cardId.trim().toUpperCase()) ?? null
  }

  activity(limit = 200): AuditEvent[] {
    return this.db.audit.slice(0, limit)
  }

  stats(): ClinicStats {
    const awaiting: Record<Band, number> = { red: 0, amber: 0, green: 0 }
    for (const p of this.db.patients) {
      const s = this.summary(p.id)
      if (s?.awaiting && s.triage) awaiting[s.triage.band]++
    }
    const today = startOfDay()
    const since = Date.parse(this.db.seededAt)
    let reviewedToday = 0
    let messagesToday = 0
    let tripsAvoided = 0
    for (const d of this.db.decisions) {
      const t = Date.parse(d.decidedAt)
      if (t >= today) {
        reviewedToday++
        if (d.message.channel === 'sms') messagesToday++
      }
      if (t >= since && d.action === 'continue') tripsAvoided++
    }
    return { awaiting, totalPatients: this.db.patients.length, reviewedToday, tripsAvoided, messagesToday }
  }

  /* ---------------------------------------------------------------- */
  /* Writes                                                            */
  /* ---------------------------------------------------------------- */

  decide(input: DecideInput, actor: string, bulk = false): { decision: Decision; summary: PatientSummary } {
    const p = this.patientsById.get(input.patientId)
    if (!p) throw new HttpError(404, 'Patient not found')
    const s = this.summary(p.id)!
    const latest = s.latest
    const scheduledFor = ACTION_NEEDS_DATE[input.action] ? (input.scheduledFor ?? suggestedDate(2)) : null
    const worker = latest?.enteredBy && latest.enteredBy !== 'Clinic desk' ? latest.enteredBy : 'your health worker'
    const now = new Date()
    const decision: Decision = {
      id: `dc-${randomUUID()}`,
      patientId: p.id,
      readingId: latest?.readingId ?? null,
      action: input.action,
      scheduledFor,
      note: (input.note ?? '').slice(0, 500),
      decidedBy: actor,
      decidedAt: now.toISOString(),
      band: s.triage?.band ?? 'green',
      message: {
        channel: p.phone ? 'sms' : 'print',
        lang: p.lang,
        text: composeMessage({ action: input.action, lang: p.lang, date: scheduledFor, clinic: this.db.clinic, worker, now }),
        to: maskPhone(p.phone),
        status: 'sent',
      },
      bulk,
    }
    this.db.decisions.push(decision)
    push(this.decisionsBy, p.id, decision)
    this.summaryCache.delete(p.id)
    const summary = this.summary(p.id)!
    if (!bulk) {
      this.audit('decision', actor, decisionDetail(input.action, p.code), p.id)
      this.emit('summaries', [summary])
      this.emit('stats', this.stats())
      this.persist()
    }
    return { decision, summary }
  }

  bulkContinueGreen(actor: string): { count: number } {
    const targets = this.db.patients
      .map((p) => this.summary(p.id)!)
      .filter((s) => s.awaiting && s.triage?.band === 'green')
    const changed: PatientSummary[] = []
    for (const s of targets) changed.push(this.decide({ patientId: s.id, action: 'continue' }, actor, true).summary)
    if (changed.length) {
      this.audit('bulk', actor, `Continue current plan sent to ${changed.length} stable patients`, undefined, changed.length)
      this.emit('summaries', changed)
      this.emit('stats', this.stats())
      this.persist()
    }
    return { count: changed.length }
  }

  ingestSync(req: SyncRequest): SyncResponse {
    const device = this.db.devices.find((d) => d.id === req.deviceId)
    if (!device) throw new HttpError(403, 'Unknown device')
    const now = new Date().toISOString()
    const touched = new Set<string>()
    const accepted = { patients: [] as string[], readings: [] as string[] }

    for (const incoming of req.patients ?? []) {
      if (!this.patientsById.has(incoming.id)) {
        const p: Patient = { ...incoming, syncedAt: now }
        this.db.patients.push(p)
        this.patientsById.set(p.id, p)
        this.byCard.set(p.cardId, p.id)
      }
      accepted.patients.push(incoming.id)
      touched.add(incoming.id)
    }

    const known = new Set(this.db.readings.map((r) => r.id))
    for (const incoming of req.readings ?? []) {
      if (!this.patientsById.has(incoming.patientId)) continue
      if (!known.has(incoming.id)) {
        const r: Reading = { ...incoming, deviceId: device.id, syncedAt: now }
        this.db.readings.push(r)
        push(this.readingsBy, r.patientId, r)
        touched.add(r.patientId)
      }
      accepted.readings.push(incoming.id)
    }

    // Decisions the device hasn't seen yet, for patients it looks after.
    const since = req.since ? Date.parse(req.since) : 0
    const mine = new Set(this.db.readings.filter((r) => r.deviceId === device.id).map((r) => r.patientId))
    const decisions = this.db.decisions.filter((d) => mine.has(d.patientId) && Date.parse(d.decidedAt) > since)

    device.lastSyncAt = now
    const count = accepted.readings.length
    if (touched.size) {
      for (const id of touched) this.summaryCache.delete(id)
      const summaries = [...touched].map((id) => this.summary(id)!).filter(Boolean)
      if (count) this.auditSync(device.worker, `${device.name} synced records`, count)
      this.emit('summaries', summaries)
      this.emit('stats', this.stats())
      this.persist()
    }
    return { accepted, decisions, serverTime: now }
  }

  /** Batches from one sync session (seconds apart) are shown as a single event. */
  private auditSync(actor: string, detail: string, count: number): void {
    const last = this.db.audit[0]
    if (last && last.kind === 'sync' && last.actor === actor && Date.now() - Date.parse(last.at) < 5000) {
      last.count = (last.count ?? 0) + count
      last.at = new Date().toISOString()
      this.emit('activity', { ...last })
      this.persist()
      return
    }
    this.audit('sync', actor, detail, undefined, count)
  }

  audit(kind: AuditKind, actor: string, detail: string, patientId?: string, count?: number): AuditEvent {
    const ev: AuditEvent = {
      id: `ev-${randomBytes(6).toString('hex')}`,
      at: new Date().toISOString(),
      actor,
      kind,
      detail,
      ...(patientId ? { patientId } : {}),
      ...(count != null ? { count } : {}),
    }
    this.db.audit.unshift(ev)
    if (this.db.audit.length > 2000) this.db.audit.length = 2000
    this.emit('activity', ev)
    this.persist()
    return ev
  }

  /* ---------------------------------------------------------------- */

  private reindex(): void {
    this.readingsBy.clear()
    this.decisionsBy.clear()
    this.patientsById.clear()
    this.byCard.clear()
    this.summaryCache.clear()
    for (const p of this.db.patients) {
      this.patientsById.set(p.id, p)
      this.byCard.set(p.cardId, p.id)
    }
    for (const r of this.db.readings) push(this.readingsBy, r.patientId, r)
    for (const d of this.db.decisions) push(this.decisionsBy, d.patientId, d)
    for (const list of this.readingsBy.values()) list.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
    for (const list of this.decisionsBy.values()) list.sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt))
  }

  private persist(): void {
    this.file.save(this.db)
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function sortSummaries(a: PatientSummary, b: PatientSummary): number {
  if (a.awaiting !== b.awaiting) return a.awaiting ? -1 : 1
  if (!a.triage || !a.latest) return 1
  if (!b.triage || !b.latest) return -1
  return comparePriority(
    { band: a.triage.band, score: a.triage.score, takenAt: a.latest.takenAt },
    { band: b.triage.band, score: b.triage.score, takenAt: b.latest.takenAt },
  )
}

function decisionDetail(action: DecisionAction, code: string): string {
  return {
    continue: `Continue current plan for #${code}`,
    review: `Requested a clinic review for #${code}`,
    refer: `Referred #${code} to hospital`,
    protocol: `Follow protocol for #${code}`,
  }[action]
}
