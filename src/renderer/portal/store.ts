import { create } from 'zustand'
import { comparePriority } from '@shared/triage'
import type { AuditEvent, Band, ClinicInfo, ClinicStats, PatientSummary, Theme } from '@shared/types'
import { api, AuthError, subscribe } from './api'

export type View = 'queue' | 'patients' | 'scan' | 'activity' | 'rules' | 'patient'

export interface Toast {
  id: number
  key?: string
  title: string
  body?: string
  tone: 'info' | 'success' | 'sync'
}

interface PortalState {
  phase: 'loading' | 'unreachable' | 'pair' | 'ready'
  actor: string
  clinic: ClinicInfo | null
  summaries: Map<string, PatientSummary>
  stats: ClinicStats | null
  rulesVersion: string
  connection: 'live' | 'reconnecting'
  view: View
  band: Band
  selectedId: string | null
  /** patient opened from Patients / Scan (outside the queue) */
  openedId: string | null
  openedVia: 'search' | 'scan'
  fresh: Map<string, number>
  activity: AuditEvent[]
  toasts: Toast[]
  theme: Theme
  bulkOpen: boolean
  setView: (v: View) => void
  setBand: (b: Band) => void
  select: (id: string | null) => void
  open: (id: string, via: 'search' | 'scan') => void
  toast: (t: Omit<Toast, 'id'>) => void
  setTheme: (t: Theme) => void
}

let toastId = 0
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()
const THEME_KEY = 'pahana.portal.theme'
const readTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'day' ? 'day' : 'night'
  } catch {
    return 'night'
  }
}

export const usePortal = create<PortalState>((set) => ({
  phase: 'loading',
  actor: '',
  clinic: null,
  summaries: new Map(),
  stats: null,
  rulesVersion: '',
  connection: 'live',
  view: 'queue',
  band: 'red',
  selectedId: null,
  openedId: null,
  openedVia: 'search',
  fresh: new Map(),
  activity: [],
  toasts: [],
  theme: readTheme(),
  bulkOpen: false,
  setView: (view) => set({ view }),
  setBand: (band) => set({ band, bulkOpen: false }),
  select: (selectedId) => set({ selectedId }),
  open: (openedId, openedVia) => set({ openedId, openedVia, view: 'patient' }),
  toast: (t) => {
    // A toast with the same key updates in place (e.g. a sync that grows batch by batch).
    const existing = t.key ? usePortal.getState().toasts.find((x) => x.key === t.key) : undefined
    const id = existing?.id ?? ++toastId
    set((s) => ({ toasts: existing ? s.toasts.map((x) => (x.id === id ? { ...t, id } : x)) : [...s.toasts.slice(-2), { ...t, id }] }))
    clearTimeout(toastTimers.get(id))
    toastTimers.set(id, setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200))
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode */
    }
    set({ theme })
  },
}))

/* ------------------------------------------------------------------ */
/* Derived: the queue for the current band                             */
/* ------------------------------------------------------------------ */

const queueCache = new WeakMap<Map<string, PatientSummary>, Record<Band, PatientSummary[]>>()

export function queues(summaries: Map<string, PatientSummary>): Record<Band, PatientSummary[]> {
  const hit = queueCache.get(summaries)
  if (hit) return hit
  const out: Record<Band, PatientSummary[]> = { red: [], amber: [], green: [] }
  for (const s of summaries.values()) if (s.awaiting && s.triage && s.latest) out[s.triage.band].push(s)
  for (const b of ['red', 'amber', 'green'] as Band[])
    out[b].sort((a, b2) =>
      comparePriority(
        { band: a.triage!.band, score: a.triage!.score, takenAt: a.latest!.takenAt },
        { band: b2.triage!.band, score: b2.triage!.score, takenAt: b2.latest!.takenAt },
      ),
    )
  queueCache.set(summaries, out)
  return out
}

export function useQueue(band: Band): PatientSummary[] {
  const summaries = usePortal((s) => s.summaries)
  return queues(summaries)[band]
}

/* ------------------------------------------------------------------ */
/* Boot + live wiring                                                  */
/* ------------------------------------------------------------------ */

let unsubscribe: (() => void) | null = null
let attempts = 0

export async function boot(): Promise<void> {
  try {
    const session = await api.session()
    attempts = 0
    usePortal.setState({ actor: session.actor, clinic: session.clinic })
    await load()
    usePortal.setState({ phase: 'ready' })
    live()
  } catch (err) {
    if (err instanceof AuthError) return usePortal.setState({ phase: 'pair' })
    // Server not reachable (portal switched off): say so, and keep trying quietly.
    if (++attempts >= 2) usePortal.setState({ phase: 'unreachable' })
    setTimeout(boot, 1500)
  }
}

async function load(): Promise<void> {
  const b = await api.bootstrap()
  const summaries = new Map(b.summaries.map((s) => [s.id, s]))
  const q = queues(summaries)
  const cur = usePortal.getState()
  const band: Band = cur.selectedId ? cur.band : q.red.length ? 'red' : q.amber.length ? 'amber' : 'green'
  usePortal.setState({
    clinic: b.clinic,
    summaries,
    stats: b.stats,
    rulesVersion: b.rulesVersion,
    band,
    selectedId: cur.selectedId && summaries.has(cur.selectedId) ? cur.selectedId : (q[band][0]?.id ?? null),
  })
  api.activity().then((activity) => usePortal.setState({ activity }), () => {})
}

function live(): void {
  unsubscribe?.()
  unsubscribe = subscribe({
    onStatus: (connection) => usePortal.setState({ connection }),
    // The stream closed for good (e.g. the app restarted and browser sessions reset).
    onClosed: async () => {
      try {
        await api.session()
        return true
      } catch (err) {
        if (err instanceof AuthError) {
          unsubscribe?.()
          usePortal.setState({ phase: 'pair' })
          return false
        }
        return true
      }
    },
    onReconnect: () => void load().catch(() => {}),
    onReset: () => {
      usePortal.setState({ selectedId: null, openedId: null, view: 'queue' })
      void load()
    },
    onStats: (stats) => usePortal.setState({ stats }),
    onActivity: (ev) => {
      usePortal.setState((s) => ({
        activity: s.activity.some((a) => a.id === ev.id) ? s.activity.map((a) => (a.id === ev.id ? ev : a)) : [ev, ...s.activity].slice(0, 400),
      }))
      if (ev.kind === 'sync' && ev.count)
        usePortal.getState().toast({ key: ev.id, tone: 'sync', title: `${ev.count} records arrived`, body: `from ${ev.detail.replace(' synced records', '')}` })
    },
    onSummaries: (list) => {
      usePortal.setState((s) => {
        const summaries = new Map(s.summaries)
        const fresh = new Map(s.fresh)
        const now = Date.now()
        for (const next of list) {
          const prev = summaries.get(next.id)
          if (next.awaiting && next.latest && prev?.latest?.readingId !== next.latest.readingId) fresh.set(next.id, now)
          summaries.set(next.id, next)
        }
        for (const [id, t] of fresh) if (now - t > 9000) fresh.delete(id)
        // Keep something selected in the current band.
        let selectedId = s.selectedId
        const q = queues(summaries)[s.band]
        if (!selectedId || !summaries.get(selectedId)) selectedId = q[0]?.id ?? null
        return { summaries, fresh, selectedId }
      })
    },
  })
}

export async function pair(code: string): Promise<void> {
  const session = await api.pair(code)
  usePortal.setState({ actor: session.actor, clinic: session.clinic })
  await load()
  usePortal.setState({ phase: 'ready' })
  live()
}
