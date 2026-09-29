import { useEffect, useState } from 'react'
import type { PatientDetail } from '@shared/types'
import { api } from './api'
import { usePortal } from './store'

const cache = new Map<string, { key: string; at: number; detail: PatientDetail }>()

/**
 * Loads a patient's full record. The server logs every open, so a record
 * re-opened within a minute is served from cache rather than logged twice.
 */
export function usePatientDetail(id: string | null, via: 'queue' | 'scan' | 'search' = 'queue') {
  const summary = usePortal((s) => (id ? s.summaries.get(id) : undefined))
  const version = `${summary?.latest?.readingId}|${summary?.lastDecision?.decidedAt}`
  const hit = id ? cache.get(id) : undefined
  const [detail, setDetail] = useState<PatientDetail | null>(hit?.key === version ? hit.detail : null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return setDetail(null)
    const c = cache.get(id)
    if (c && c.key === version && Date.now() - c.at < 60_000) {
      setDetail(c.detail)
      return
    }
    if (!c || c.key !== version) setDetail(c?.detail ?? null)
    let alive = true
    api.patient(id, via).then(
      (d) => {
        cache.set(id, { key: version, at: Date.now(), detail: d })
        if (alive) {
          setDetail(d)
          setError(null)
        }
      },
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [id, version, via])

  return { detail: detail?.patient.id === id ? detail : null, summary, error }
}
