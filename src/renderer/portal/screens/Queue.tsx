import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { relativeTime } from '@shared/format'
import { formatReason } from '@shared/reasons'
import type { Band, PatientSummary } from '@shared/types'
import { BandMark } from '@ui/Band'
import { Kbd, Odometer } from '@ui/controls'
import { BulkGreen } from '../components/BulkGreen'
import { DecisionPanel } from '../components/Decision'
import { Review } from '../components/Review'
import { useMediaQuery } from '../hooks'
import { queues, usePortal, useQueue } from '../store'

const BAND_LABEL: Record<Band, string> = { red: 'Red', amber: 'Amber', green: 'Green' }
const BAND_SUB: Record<Band, string> = { red: 'Review first', amber: 'Review soon', green: 'Stable' }

export function QueueWorkspace() {
  const band = usePortal((s) => s.band)
  const selectedId = usePortal((s) => s.selectedId)
  const bulkOpen = usePortal((s) => s.bulkOpen)
  const queue = useQueue(band)
  const [mobileDetail, setMobileDetail] = useState(false)
  // Narrower screens show the decision under the review instead of in a third column.
  // Only one DecisionPanel is ever mounted, so its keyboard shortcuts never fire twice.
  const inlineDecision = useMediaQuery('(max-width: 1280px)')
  useQueueKeys(queue)

  // Keep a patient selected in the visible band.
  useEffect(() => {
    const s = usePortal.getState()
    const cur = s.selectedId ? s.summaries.get(s.selectedId) : null
    if (!cur || (cur.triage?.band !== band && cur.awaiting)) s.select(queue[0]?.id ?? null)
  }, [band, queue])

  return (
    <div className="workspace" data-mobile-detail={mobileDetail}>
      <BandTabs />
      <div className="col col-list flex min-h-0 flex-col">
        <QueueList queue={queue} band={band} onOpen={() => setMobileDetail(true)} />
      </div>
      {bulkOpen && band === 'green' ? (
        <div className="col col-review scroll" style={{ gridColumn: '2 / -1' }}>
          <BulkGreen />
        </div>
      ) : (
        <>
          <div className="col col-review scroll">
            <button className="btn btn-ghost btn-sm m-3 md:hidden" onClick={() => setMobileDetail(false)}>
              <ChevronLeft size={15} /> Queue
            </button>
            {selectedId ? (
              <>
                <Review patientId={selectedId} via="queue" />
                {inlineDecision && (
                  <div className="mx-auto max-w-[560px] border-t border-line-soft">
                    <DecisionPanel patientId={selectedId} />
                  </div>
                )}
              </>
            ) : (
              <EmptyQueue band={band} />
            )}
          </div>
          {!inlineDecision && <div className="col col-decision scroll">{selectedId && <DecisionPanel patientId={selectedId} />}</div>}
        </>
      )}
    </div>
  )
}

function BandTabs() {
  const band = usePortal((s) => s.band)
  const setBand = usePortal((s) => s.setBand)
  const summaries = usePortal((s) => s.summaries)
  const stats = usePortal((s) => s.stats)
  const q = queues(summaries)
  return (
    <div className="bands px-5 pt-5 pb-4" role="tablist" aria-label="Priority">
      {(['red', 'amber', 'green'] as Band[]).map((b) => (
        <button key={b} role="tab" aria-selected={band === b} data-band={b} className="band-tab" onClick={() => setBand(b)}>
          <BandMark band={b} size={16} />
          <span className="band-label flex flex-col leading-none">
            <span className="text-[12px] font-bold tracking-[0.08em] uppercase opacity-90">{BAND_LABEL[b]}</span>
            <span className="band-sub mt-1 text-[11.5px] font-semibold opacity-70">{BAND_SUB[b]}</span>
          </span>
          <span className="band-grow flex-1" />
          <span className="display text-[30px] leading-none font-[680] tracking-[-0.03em]">
            <Odometer value={q[b].length} />
          </span>
        </button>
      ))}
      <div className="band-spacer" />
      {stats && (
        <div className="band-metrics flex items-center gap-7 pr-1">
          <Metric label="Reviewed today" value={stats.reviewedToday} />
          <Metric label="Trips avoided" value={stats.tripsAvoided} accent />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="display text-[24px] leading-none font-[650] tracking-[-0.02em]" style={{ color: accent && value ? 'var(--green-text)' : 'var(--text)' }}>
        <Odometer value={value} />
      </div>
      <div className="mt-1.5 text-[11.5px] font-semibold text-fg-3">{label}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function QueueList({ queue, band, onOpen }: { queue: PatientSummary[]; band: Band; onOpen: () => void }) {
  const selectedId = usePortal((s) => s.selectedId)
  const select = usePortal((s) => s.select)
  const fresh = usePortal((s) => s.fresh)
  const bulkOpen = usePortal((s) => s.bulkOpen)
  const parentRef = useRef<HTMLDivElement>(null)
  const big = queue.length > 60
  const virtual = useVirtualizer({
    count: big ? queue.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 8,
  })

  useEffect(() => {
    if (!big || !selectedId) return
    const i = queue.findIndex((s) => s.id === selectedId)
    if (i >= 0) virtual.scrollToIndex(i, { align: 'auto' })
  }, [selectedId, big, queue, virtual])

  const item = (s: PatientSummary, i: number) => (
    <QueueItem
      key={s.id}
      s={s}
      rank={i + 1}
      selected={s.id === selectedId && !bulkOpen}
      fresh={fresh.has(s.id)}
      onClick={() => {
        usePortal.setState({ bulkOpen: false })
        select(s.id)
        onOpen()
      }}
    />
  )

  return (
    <>
      {band === 'green' && queue.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => usePortal.setState({ bulkOpen: !bulkOpen })}
            data-band="green"
            className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-colors duration-150"
            style={{ background: bulkOpen ? 'var(--green-soft)' : 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--green-line)' }}
          >
            <Send size={17} className="flex-none text-green" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">Skip the trip for {queue.length} stable patients</span>
              <span className="block text-[12px] text-fg-3">Send “continue current plan” in one step</span>
            </span>
          </button>
        </div>
      )}
      <div ref={parentRef} className="scroll min-h-0 flex-1 px-3 pb-3">
        {queue.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13.5px] text-fg-3">No {BAND_LABEL[band].toLowerCase()} patients waiting.</p>
        ) : big ? (
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((v) => (
              <div key={queue[v.index].id} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}>
                {item(queue[v.index], v.index)}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {queue.map((s, i) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.22 } }}
                  transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
                >
                  {item(s, i)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <div className="hidden items-center gap-3 border-t border-line-soft px-5 py-2.5 text-[11.5px] text-fg-4 lg:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>1</Kbd>–<Kbd>4</Kbd> decide
        </span>
        <span className="flex items-center gap-1">
          <Kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>↵</Kbd> record
        </span>
      </div>
    </>
  )
}

function QueueItem({ s, rank, selected, fresh, onClick }: { s: PatientSummary; rank: number; selected: boolean; fresh: boolean; onClick: () => void }) {
  const t = s.triage!
  const l = s.latest!
  const top = t.reasons.find((r) => r.band !== 'info' && r.band !== 'green')
  const bpBad = t.reasons.some((r) => r.code.startsWith('bp_'))
  const glBad = t.reasons.some((r) => r.code.startsWith('gl_'))
  return (
    <button className="q-item" aria-selected={selected} data-band={t.band} onClick={onClick}>
      {fresh && (
        <motion.span
          className="fresh-ring"
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.25, 1, 0] }}
          transition={{ duration: 6, times: [0, 0.3, 0.6, 1] }}
        />
      )}
      <span className="q-rank">{rank}</span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold">{s.name}</span>
          <span className="mono flex-none text-[11.5px] text-fg-4">#{s.code}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
          {top ? formatReason(top) : `${s.area} · ${s.age}${s.sex}`}
        </span>
        <span className="tnum mt-1.5 flex items-center gap-3 text-[12.5px]">
          {l.sys != null && <span style={{ color: bpBad ? `var(--${t.band === 'green' ? 'text' : t.band}-text)` : 'var(--text-2)' }}>{l.sys}/{l.dia}</span>}
          {l.glucose != null && (
            <span style={{ color: glBad ? `var(--${t.band === 'green' ? 'text' : t.band}-text)` : 'var(--text-2)' }}>
              {l.glucoseType === 'fasting' ? 'FBS' : 'RBS'} {l.glucose}
            </span>
          )}
          {l.missedDays > 0 && <span className="text-fg-3">missed {l.missedDays}d</span>}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1.5">
        <span className="text-[11.5px] whitespace-nowrap text-fg-4">{relativeTime(l.takenAt)}</span>
        {fresh && <span className="rounded-full bg-accent-soft px-1.5 text-[10.5px] font-bold text-accent-text uppercase">New</span>}
      </span>
    </button>
  )
}

function EmptyQueue({ band }: { band: Band }) {
  const setBand = usePortal((s) => s.setBand)
  const q = queues(usePortal.getState().summaries)
  const next = (['red', 'amber', 'green'] as Band[]).find((b) => b !== band && q[b].length)
  return (
    <div className="grid h-full place-items-center p-10 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-soft text-green">
          <BandMark band={band} size={18} />
        </div>
        <h2 className="mt-5 text-[22px]">All {BAND_LABEL[band].toLowerCase()} patients reviewed</h2>
        {next && (
          <button className="btn btn-secondary mt-5" onClick={() => setBand(next)}>
            Go to {BAND_LABEL[next].toLowerCase()} ({q[next].length})
          </button>
        )}
      </div>
    </div>
  )
}

/** ↑/↓ moves through the queue; R / A / G switch bands. */
function useQueueKeys(queue: PatientSummary[]) {
  const ids = useMemo(() => queue.map((s) => s.id), [queue])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const s = usePortal.getState()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        const i = ids.indexOf(s.selectedId ?? '')
        const next = e.key === 'ArrowDown' || e.key === 'j' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1)
        if (ids[next]) {
          usePortal.setState({ bulkOpen: false })
          s.select(ids[next])
        }
      }
      const bandKey: Record<string, Band> = { r: 'red', a: 'amber', g: 'green' }
      if (bandKey[e.key]) s.setBand(bandKey[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids])
}
