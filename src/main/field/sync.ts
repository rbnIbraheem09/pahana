import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { Reading, SyncLogEntry, SyncRequest, SyncResponse, SyncStatus } from '@shared/types'
import { signBody } from '../clinic/server'
import type { FieldStore } from './store'

const BATCH = 12
const POLL_MS = 4000

type SyncEvents = {
  status: [SyncStatus]
  decisions: [number]
}

/**
 * Pushes the device outbox to the clinic server in signed batches and pulls
 * back the doctor's decisions. Batching keeps each request small, which is
 * what you want on a weak rural connection: a dropped batch just retries.
 */
export class SyncClient extends EventEmitter<SyncEvents> {
  private running: Promise<SyncLogEntry | null> | null = null
  private poll: NodeJS.Timeout | null = null
  private status: SyncStatus = { phase: 'idle', total: 0, sent: 0, error: null, lastResult: null }

  constructor(
    private readonly field: FieldStore,
    private readonly serverUrl: () => string | null,
  ) {
    super()
  }

  current(): SyncStatus {
    return this.status
  }

  startPolling(): void {
    this.stopPolling()
    this.poll = setInterval(() => {
      if (this.canSync() && this.field.settings.autoSync) void this.sync({ quiet: true })
    }, POLL_MS)
  }

  stopPolling(): void {
    if (this.poll) clearInterval(this.poll)
    this.poll = null
  }

  canSync(): boolean {
    return this.field.online && !!this.serverUrl()
  }

  /** Runs one sync. Concurrent calls share the in-flight run. */
  sync(opts: { quiet?: boolean } = {}): Promise<SyncLogEntry | null> {
    if (this.running) return this.running
    this.running = this.run(opts).finally(() => {
      this.running = null
    })
    return this.running
  }

  private async run({ quiet }: { quiet?: boolean }): Promise<SyncLogEntry | null> {
    const base = this.serverUrl()
    const pending = this.field.pending()
    const total = pending.readings.length + pending.patients.length

    if (!this.field.online) return this.fail('No signal. Records are safe on this device.', total, quiet)
    if (!base) return this.fail('Clinic server is not reachable. Turn on the clinic portal.', total, quiet)
    if (quiet && total === 0) return this.pullOnly(base)

    const started = performance.now()
    this.set({ phase: 'syncing', total, sent: 0, error: null })
    let received = 0
    try {
      // New patients travel with the first batch so their readings are accepted.
      const batches: { patients: typeof pending.patients; readings: Reading[] }[] = []
      for (let i = 0; i < Math.max(1, pending.readings.length); i += BATCH) {
        batches.push({ patients: i === 0 ? pending.patients : [], readings: pending.readings.slice(i, i + BATCH) })
      }
      let sent = 0
      for (const batch of batches) {
        const res = await this.post(base, batch.patients, batch.readings)
        received += this.field.applySync(res.accepted, res.decisions, res.serverTime)
        sent += res.accepted.readings.length + res.accepted.patients.length
        this.set({ phase: 'syncing', total, sent, error: null })
      }
      const entry: SyncLogEntry = {
        id: `sl-${randomBytes(4).toString('hex')}`,
        at: new Date().toISOString(),
        ok: true,
        sent,
        received,
        ms: Math.max(1, Math.round(performance.now() - started)),
      }
      this.field.logSync(entry)
      if (received) this.emit('decisions', received)
      this.set({ phase: 'done', total, sent, error: null, lastResult: entry })
      return entry
    } catch (err) {
      return this.fail(err instanceof Error ? err.message : 'Sync failed', total, quiet)
    }
  }

  private async pullOnly(base: string): Promise<SyncLogEntry | null> {
    try {
      const res = await this.post(base, [], [])
      const received = this.field.applySync(res.accepted, res.decisions, res.serverTime)
      if (received) {
        const entry: SyncLogEntry = {
          id: `sl-${randomBytes(4).toString('hex')}`,
          at: new Date().toISOString(),
          ok: true,
          sent: 0,
          received,
          ms: 1,
        }
        this.field.logSync(entry)
        this.emit('decisions', received)
        return entry
      }
    } catch {
      /* silent: background poll */
    }
    return null
  }

  private async post(base: string, patients: SyncRequest['patients'], readings: Reading[]): Promise<SyncResponse> {
    const device = this.field.device
    const body = JSON.stringify({ deviceId: device.id, since: this.field.lastSyncAt, patients, readings } satisfies SyncRequest)
    const res = await fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pahana-Device': device.id,
        'X-Pahana-Signature': signBody(device.secret, body),
      },
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error
      throw new Error(msg ?? `Clinic server answered ${res.status}`)
    }
    return (await res.json()) as SyncResponse
  }

  private fail(error: string, total: number, quiet?: boolean): null {
    if (!quiet) this.set({ phase: 'error', total, sent: 0, error })
    return null
  }

  private set(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', this.status)
  }
}
