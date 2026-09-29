import { motion } from 'motion/react'
import { CloudDownload, Eye, KeyRound, ListChecks, Radio, ScanLine, Send, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { startOfDay, timeOfDay } from '@shared/format'
import type { AuditEvent, AuditKind } from '@shared/types'
import { Segmented } from '@ui/controls'
import { usePortal } from '../store'

type Filter = 'all' | 'access' | 'decisions' | 'sync'

const ICON: Record<AuditKind, typeof Eye> = {
  open: Eye,
  scan: ScanLine,
  decision: ListChecks,
  bulk: Send,
  sync: CloudDownload,
  pair: KeyRound,
  portal: Radio,
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export function ActivityLog() {
  const activity = usePortal((s) => s.activity)
  const summaries = usePortal((s) => s.summaries)
  const open = usePortal((s) => s.open)
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const keep = (e: AuditEvent) =>
      filter === 'all' ||
      (filter === 'access' && (e.kind === 'open' || e.kind === 'scan' || e.kind === 'pair')) ||
      (filter === 'decisions' && (e.kind === 'decision' || e.kind === 'bulk')) ||
      (filter === 'sync' && e.kind === 'sync')
    const out: { day: string; items: AuditEvent[] }[] = []
    for (const e of activity.filter(keep)) {
      const day = DAY.format(new Date(startOfDay(Date.parse(e.at))))
      const g = out[out.length - 1]
      if (g && g.day === day) g.items.push(e)
      else out.push({ day, items: [e] })
    }
    return out
  }, [activity, filter])

  const opens = activity.filter((e) => e.kind === 'open' || e.kind === 'scan').length

  return (
    <div className="scroll h-full">
      <div className="mx-auto max-w-[880px] px-8 pt-8 pb-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px]">Access log</h2>
            <p className="mt-2 flex items-center gap-2 text-fg-3">
              <ShieldCheck size={15} />
              Every record opened, every card scanned and every decision is written here. {opens} record opens so far.
            </p>
          </div>
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'access', label: 'Record access' },
              { value: 'decisions', label: 'Decisions' },
              { value: 'sync', label: 'Syncs' },
            ]}
          />
        </div>

        {groups.map((g) => (
          <section key={g.day} className="mt-9">
            <div className="eyebrow mb-3">{g.day}</div>
            <ol className="flex flex-col">
              {g.items.map((e, i) => {
                const Icon = ICON[e.kind]
                const p = e.patientId ? summaries.get(e.patientId) : undefined
                return (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.015 }}
                    className="flex items-center gap-4 border-b border-line-soft py-3 last:border-0"
                  >
                    <span className="mono w-14 flex-none text-[12px] text-fg-4">{timeOfDay(e.at)}</span>
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-surface text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">
                        {e.detail}
                        {e.count != null && e.kind === 'sync' && <span className="tnum ml-1.5 font-semibold">· {e.count} records</span>}
                      </span>
                      <span className="block text-[12px] text-fg-3">{e.actor}</span>
                    </span>
                    {p && (
                      <button className="btn btn-ghost btn-sm" onClick={() => open(p.id, 'search')}>
                        {p.name}
                      </button>
                    )}
                  </motion.li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
