import { randomBytes, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { cardIdFrom } from '@shared/random'
import type { FieldDB } from '@shared/seed'
import type {
  Decision,
  FieldSettings,
  FieldState,
  NewPatientInput,
  NewReadingInput,
  Patient,
  Reading,
  SyncLogEntry,
} from '@shared/types'
import { JsonFile } from '../lib/jsonFile'

type FieldEvents = { change: [FieldState] }

const secureRandom = () => randomBytes(4).readUInt32BE() / 0x1_0000_0000

/** Everything that lives on the health worker's device. Works with no network at all. */
export class FieldStore extends EventEmitter<FieldEvents> {
  private db!: FieldDB
  private emitTimer: NodeJS.Timeout | null = null

  constructor(private readonly file: JsonFile<FieldDB>) {
    super()
  }

  load(fallback: () => FieldDB): void {
    this.db = this.file.read() ?? fallback()
    this.persist()
  }

  replace(db: FieldDB): void {
    this.db = db
    this.persist()
  }

  state(): FieldState {
    const { version: _v, ...rest } = this.db
    return rest
  }

  get online() {
    return this.db.online
  }

  get settings() {
    return this.db.settings
  }

  get device() {
    return this.db.device
  }

  get lastSyncAt() {
    return this.db.lastSyncAt
  }

  get demo() {
    return { pristine: !!this.db.pristine, seededAt: this.db.seededAt }
  }

  flush(): void {
    this.file.flush()
  }

  registerPatient(input: NewPatientInput): Patient {
    const taken = new Set(this.db.patients.map((p) => p.code))
    let code = ''
    do code = String(2000 + Math.floor(secureRandom() * 7999)).padStart(4, '0')
    while (taken.has(code))
    const now = new Date().toISOString()
    const patient: Patient = {
      id: `pt-${randomUUID()}`,
      code,
      cardId: cardIdFrom(secureRandom),
      name: input.name.trim(),
      age: input.age,
      sex: input.sex,
      lang: input.lang,
      phone: input.phone?.trim() || null,
      phoneType: input.phone?.trim() ? (input.phoneType ?? 'basic') : null,
      nic: input.nic?.trim() || null,
      area: input.area.trim() || this.db.device.division,
      conditions: input.conditions,
      consentAt: now,
      registeredBy: this.db.device.workerName,
      createdAt: now,
      syncedAt: null,
    }
    this.db.patients.unshift(patient)
    this.db.pristine = false
    this.persist()
    return patient
  }

  addReading(input: NewReadingInput): Reading {
    if (!this.db.patients.some((p) => p.id === input.patientId)) throw new Error('Unknown patient')
    const reading: Reading = {
      id: `rd-${randomUUID()}`,
      patientId: input.patientId,
      takenAt: new Date().toISOString(),
      sys: input.sys,
      dia: input.dia,
      glucose: input.glucose,
      glucoseType: input.glucoseType,
      symptoms: input.symptoms,
      missedDays: input.missedDays,
      notes: input.notes.trim().slice(0, 1000),
      source: 'worker',
      enteredBy: this.db.device.workerName,
      deviceId: this.db.device.id,
      syncedAt: null,
    }
    this.db.readings.push(reading)
    this.db.pristine = false
    this.persist()
    return reading
  }

  setOnline(online: boolean): void {
    this.db.online = online
    this.persist()
  }

  updateSettings(patch: Partial<FieldSettings>): void {
    this.db.settings = { ...this.db.settings, ...patch }
    this.persist()
  }

  updateProfile(patch: Partial<Pick<FieldDB['device'], 'workerName' | 'workerRole' | 'division'>>): void {
    this.db.device = { ...this.db.device, ...patch }
    this.persist()
  }

  pending(): { patients: Patient[]; readings: Reading[] } {
    return {
      patients: this.db.patients.filter((p) => !p.syncedAt),
      readings: this.db.readings.filter((r) => !r.syncedAt),
    }
  }

  applySync(accepted: { patients: string[]; readings: string[] }, decisions: Decision[], serverTime: string): number {
    const pSet = new Set(accepted.patients)
    const rSet = new Set(accepted.readings)
    for (const p of this.db.patients) if (pSet.has(p.id)) p.syncedAt = serverTime
    for (const r of this.db.readings) if (rSet.has(r.id)) r.syncedAt = serverTime
    const known = new Set(this.db.decisions.map((d) => d.id))
    const fresh = decisions.filter((d) => !known.has(d.id))
    this.db.decisions.push(...fresh)
    this.db.lastSyncAt = serverTime
    if (rSet.size || pSet.size || fresh.length) this.db.pristine = false
    this.persist()
    return fresh.length
  }

  logSync(entry: SyncLogEntry): void {
    this.db.syncLog.unshift(entry)
    if (this.db.syncLog.length > 50) this.db.syncLog.length = 50
    this.persist()
  }

  private persist(): void {
    this.file.save(this.db)
    // Coalesce bursts of changes into a single state push to the UI.
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      this.emit('change', this.state())
    }, 8)
  }
}
