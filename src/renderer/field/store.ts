import { create } from 'zustand'
import { triage } from '@shared/triage'
import type {
  Band,
  Decision,
  FieldState,
  Patient,
  PortalStatus,
  Reading,
  RequestLogEntry,
  SyncStatus,
  TriageResult,
} from '@shared/types'

export type Route = 'today' | 'new' | 'patients' | 'sync' | 'cards' | 'portal' | 'settings'

export interface Flight {
  id: number
  x: number
  y: number
  band: Band | null
}

export interface Toast {
  id: number
  tone: 'success' | 'info' | 'error'
  title: string
  body?: string
}

interface FieldUI {
  state: FieldState | null
  sync: SyncStatus
  portal: PortalStatus
  requests: RequestLogEntry[]
  route: Route
  params: { patientId?: string; register?: boolean }
  sidebarCollapsed: boolean
  win: { fullscreen: boolean; focused: boolean }
  toasts: Toast[]
  /** increments each time a record lands in the outbox (drives the badge pop) */
  outboxPulse: number
  flights: Flight[]
  launch: (from: DOMRect, band: Band | null) => void
  land: (id: number) => void
  navigate: (route: Route, params?: FieldUI['params']) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

const emptyPortal: PortalStatus = {
  running: false,
  port: null,
  lan: false,
  localUrl: null,
  lanUrl: null,
  pairCode: null,
  pairUrl: null,
  lanPairUrl: null,
  viewers: 0,
  startedAt: null,
}

let toastId = 0

export const useField = create<FieldUI>((set) => ({
  state: null,
  sync: { phase: 'idle', total: 0, sent: 0, error: null, lastResult: null },
  portal: emptyPortal,
  requests: [],
  route: 'today',
  params: {},
  sidebarCollapsed: false,
  win: { fullscreen: false, focused: true },
  toasts: [],
  outboxPulse: 0,
  flights: [],
  launch: (from, band) =>
    set((s) => ({ flights: [...s.flights, { id: ++toastId, x: from.left + from.width / 2, y: from.top + from.height / 2, band }] })),
  land: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id), outboxPulse: s.outboxPulse + 1 })),
  navigate: (route, params = {}) => set({ route, params }),
  toast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === 'error' ? 6000 : 4200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

/* ------------------------------------------------------------------ */
/* Derived data (memoised per state snapshot)                          */
/* ------------------------------------------------------------------ */

export interface PatientView {
  patient: Patient
  readings: Reading[] // oldest → newest
  latest: Reading | null
  triage: TriageResult | null
  decisions: Decision[] // newest first
  pending: number
}

export interface FieldIndex {
  patients: PatientView[]
  byId: Map<string, PatientView>
  pendingReadings: Reading[]
  pendingPatients: Patient[]
  pendingCount: number
}

const cache = new WeakMap<FieldState, FieldIndex>()

export function indexOf(state: FieldState): FieldIndex {
  const hit = cache.get(state)
  if (hit) return hit
  const readingsBy = new Map<string, Reading[]>()
  for (const r of state.readings) {
    const list = readingsBy.get(r.patientId)
    if (list) list.push(r)
    else readingsBy.set(r.patientId, [r])
  }
  const decisionsBy = new Map<string, Decision[]>()
  for (const d of state.decisions) {
    const list = decisionsBy.get(d.patientId)
    if (list) list.push(d)
    else decisionsBy.set(d.patientId, [d])
  }
  const patients: PatientView[] = state.patients.map((patient) => {
    const readings = (readingsBy.get(patient.id) ?? []).slice().sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
    const latest = readings[readings.length - 1] ?? null
    const t = latest
      ? triage(latest, { history: readings.slice(0, -1), conditions: patient.conditions, readingId: latest.id })
      : null
    const decisions = (decisionsBy.get(patient.id) ?? []).slice().sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
    return {
      patient,
      readings,
      latest,
      triage: t,
      decisions,
      pending: readings.filter((r) => !r.syncedAt).length + (patient.syncedAt ? 0 : 1),
    }
  })
  const pendingReadings = state.readings.filter((r) => !r.syncedAt)
  const pendingPatients = state.patients.filter((p) => !p.syncedAt)
  const idx: FieldIndex = {
    patients,
    byId: new Map(patients.map((p) => [p.patient.id, p])),
    pendingReadings,
    pendingPatients,
    pendingCount: pendingReadings.length + pendingPatients.length,
  }
  cache.set(state, idx)
  return idx
}

export function useIndex(): FieldIndex | null {
  const state = useField((s) => s.state)
  return state ? indexOf(state) : null
}

export function bandOf(v: PatientView | undefined | null): Band | null {
  return v?.triage?.band ?? null
}

/* ------------------------------------------------------------------ */
/* Wire the store to the main process                                  */
/* ------------------------------------------------------------------ */

export async function connect(): Promise<void> {
  const api = window.pahana
  const [state, sync, portal, win] = await Promise.all([api.field.get(), api.sync.get(), api.portal.get(), api.win.state()])
  useField.setState({ state, sync, portal, win })

  api.field.onState((next) => useField.setState({ state: next }))
  api.sync.onStatus((sync) => useField.setState({ sync }))
  api.portal.onStatus((portal) => useField.setState({ portal }))
  api.portal.onRequests((entries) => useField.setState((s) => ({ requests: [...entries.reverse(), ...s.requests].slice(0, 80) })))
  api.win.onState((win) => useField.setState({ win }))
}
