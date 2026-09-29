import type {
  AuditEvent,
  Bootstrap,
  ClinicInfo,
  ClinicStats,
  Decision,
  DecisionAction,
  PatientDetail,
  PatientSummary,
} from '@shared/types'
import type { RuleRow } from '@shared/triage'

export class AuthError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new AuthError(body.error ?? 'Not paired')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

export const api = {
  session: () => req<{ actor: string; clinic: ClinicInfo }>('/api/session'),
  pair: (code: string) => req<{ actor: string; clinic: ClinicInfo }>('/api/session', { method: 'POST', body: JSON.stringify({ code }) }),
  bootstrap: () => req<Bootstrap>('/api/bootstrap'),
  patient: (id: string, via: 'queue' | 'scan' | 'search' = 'queue') => req<PatientDetail>(`/api/patients/${id}?via=${via}`),
  card: (cardId: string) => req<{ patientId: string }>(`/api/cards/${encodeURIComponent(cardId)}`),
  decide: (body: { patientId: string; action: DecisionAction; scheduledFor?: string | null; note?: string }) =>
    req<{ decision: Decision; summary: PatientSummary }>('/api/decisions', { method: 'POST', body: JSON.stringify(body) }),
  bulkGreen: () => req<{ count: number }>('/api/decisions/bulk-green', { method: 'POST', body: '{}' }),
  activity: () => req<AuditEvent[]>('/api/activity?limit=400'),
  rules: () => req<{ version: string; rules: RuleRow[] }>('/api/rules'),
}

export interface LiveHandlers {
  onSummaries: (s: PatientSummary[]) => void
  onActivity: (e: AuditEvent) => void
  onStats: (s: ClinicStats) => void
  onReset: () => void
  onStatus: (s: 'live' | 'reconnecting') => void
  onReconnect: () => void
  /** return false to stop reconnecting */
  onClosed: () => Promise<boolean>
}

/** Server-sent events with automatic reconnection (EventSource retries on its own). */
export function subscribe(h: LiveHandlers): () => void {
  let es: EventSource | null = null
  let wasDown = false
  let closed = false
  const open = () => {
    es = new EventSource('/api/events')
    es.addEventListener('hello', () => {
      h.onStatus('live')
      if (wasDown) h.onReconnect()
      wasDown = false
    })
    es.addEventListener('summaries', (e) => h.onSummaries(JSON.parse((e as MessageEvent).data)))
    es.addEventListener('activity', (e) => h.onActivity(JSON.parse((e as MessageEvent).data)))
    es.addEventListener('stats', (e) => h.onStats(JSON.parse((e as MessageEvent).data)))
    es.addEventListener('reset', () => h.onReset())
    es.onerror = () => {
      wasDown = true
      h.onStatus('reconnecting')
      // A closed stream (server restarted, or answered 401) needs a fresh EventSource.
      if (es?.readyState === EventSource.CLOSED && !closed)
        setTimeout(() => {
          void h.onClosed().then((retry) => {
            if (retry && !closed) open()
          })
        }, 2000)
    }
  }
  open()
  return () => {
    closed = true
    es?.close()
  }
}
