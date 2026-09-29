import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { relativeTime } from '@shared/format'
import { ACTION_LABEL } from '@shared/messages'
import { bandRank } from '@shared/triage'
import type { Band, PatientSummary } from '@shared/types'
import { BandMark } from '@ui/Band'
import { Segmented } from '@ui/controls'
import { usePortal } from '../store'

type Filter = 'all' | 'awaiting' | Band

const COLS = 'grid-cols-[28px_minmax(180px,1.6fr)_minmax(100px,0.9fr)_110px_120px_110px_minmax(140px,1fr)]'

export function PatientsTable() {
  const summaries = usePortal((s) => s.summaries)
  const open = usePortal((s) => s.open)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const parentRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/^#/, '')
    const list: PatientSummary[] = []
    for (const s of summaries.values()) {
      if (filter === 'awaiting' && !s.awaiting) continue
      if ((filter === 'red' || filter === 'amber' || filter === 'green') && s.triage?.band !== filter) continue
      if (query && !(s.name.toLowerCase().includes(query) || s.code.includes(query) || s.cardId.toLowerCase().includes(query) || s.area.toLowerCase().includes(query)))
        continue
      list.push(s)
    }
    return list.sort(
      (a, b) =>
        Number(b.awaiting) - Number(a.awaiting) ||
        bandRank(b.triage?.band ?? 'green') - bandRank(a.triage?.band ?? 'green') ||
        (b.triage?.score ?? 0) - (a.triage?.score ?? 0),
    )
  }, [summaries, q, filter])

  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 58, overscan: 12 })

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-4">
        <h2 className="mr-2 text-[22px]">Patients</h2>
        <div className="relative w-[320px] max-w-full">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-4" />
          <input autoFocus className="input pl-9" placeholder="Name, number, card ID or estate" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'awaiting', label: 'Awaiting review' },
            { value: 'red', label: <BandMark band="red" size={9} />, title: 'Red' },
            { value: 'amber', label: <BandMark band="amber" size={9} />, title: 'Amber' },
            { value: 'green', label: <BandMark band="green" size={9} />, title: 'Green' },
          ]}
        />
        <div className="flex-1" />
        <span className="tnum text-[13px] font-semibold text-fg-3">{rows.length.toLocaleString('en-GB')} patients</span>
      </div>
      <div className={`grid ${COLS} gap-3 border-y border-line-soft px-6 py-2.5 text-[11px] font-bold tracking-[0.06em] text-fg-4 uppercase`}>
        <span />
        <span>Patient</span>
        <span>Estate</span>
        <span>BP</span>
        <span>Glucose</span>
        <span>Reading</span>
        <span>Status</span>
      </div>
      <div ref={parentRef} className="scroll min-h-0 flex-1">
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((item) => {
            const s = rows[item.index]
            const l = s.latest
            return (
              <button
                key={s.id}
                onClick={() => open(s.id, 'search')}
                className={`row-hover absolute inset-x-0 grid ${COLS} items-center gap-3 border-b border-line-soft px-6 text-left text-[13.5px]`}
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              >
                <span>{s.triage && <BandMark band={s.triage.band} size={10} />}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="mono block text-[11.5px] text-fg-4">
                    #{s.code} · {s.age}
                    {s.sex}
                  </span>
                </span>
                <span className="truncate text-fg-2">{s.area}</span>
                <span className="tnum">{l?.sys ? `${l.sys}/${l.dia}` : '—'}</span>
                <span className="tnum">
                  {l?.glucose ? (
                    <>
                      {l.glucose} <span className="text-[11px] text-fg-4">{l.glucoseType === 'fasting' ? 'FBS' : 'RBS'}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-fg-3">{l ? relativeTime(l.takenAt) : '—'}</span>
                <span className="truncate">
                  {s.awaiting ? (
                    <span className="font-semibold text-accent-text">Awaiting review</span>
                  ) : s.lastDecision ? (
                    <span className="text-fg-3">{ACTION_LABEL[s.lastDecision.action].en}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
