import { motion } from 'motion/react'
import { CloudOff, MessageSquareText, Plus, UploadCloud } from 'lucide-react'
import { useMemo } from 'react'
import { DAY_MS, startOfDay, timeOfDay } from '@shared/format'
import { ACTION_LABEL } from '@shared/messages'
import { BandChip, BandMark } from '@ui/Band'
import { Ring } from '@ui/controls'
import { useT } from '../i18n'
import { useField, useIndex } from '../store'
import { Avatar } from './NewReading'

export function Today() {
  const { t, lang } = useT()
  const idx = useIndex()
  const state = useField((s) => s.state)!
  const navigate = useField((s) => s.navigate)
  const sync = useField((s) => s.sync)
  const portal = useField((s) => s.portal.running)

  const data = useMemo(() => {
    if (!idx) return null
    const today = startOfDay()
    const round = idx.patients
      .flatMap((v) => v.readings.filter((r) => Date.parse(r.takenAt) >= today).map((r) => ({ v, r })))
      .sort((a, b) => Date.parse(b.r.takenAt) - Date.parse(a.r.takenAt))
    const roundLatest = round.filter(({ v, r }) => v.latest?.id === r.id)
    const red = roundLatest.filter(({ v }) => v.triage?.band === 'red').length
    const decisions = state.decisions
      .slice()
      .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
      .slice(0, 6)
      .map((d) => ({ d, v: idx.byId.get(d.patientId) }))
    const due = idx.patients
      .filter((v) => v.latest && Date.now() - Date.parse(v.latest.takenAt) > 30 * DAY_MS)
      .sort((a, b) => Date.parse(a.latest!.takenAt) - Date.parse(b.latest!.takenAt))
      .slice(0, 6)
    return { round, red, decisions, due }
  }, [idx, state.decisions])

  if (!idx || !data) return <div />
  const hour = new Date().getHours()
  const greetKey = hour < 12 ? 'today.morning' : hour < 17 ? 'today.afternoon' : 'today.evening'
  const first = state.device.workerName.split(' ').slice(-1)[0]
  const pending = idx.pendingCount
  const syncing = sync.phase === 'syncing'

  return (
    <div className="scroll h-full">
      <div className="screen-pad mx-auto max-w-[1180px]">
        <div className="flex items-end justify-between gap-6 pt-2">
          <div>
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="text-[34px] font-[660]">
              {t(greetKey, { name: first })}
            </motion.h2>
            <p className="mt-1.5 text-fg-3">
              {state.device.workerRole} · {state.device.division} · {state.clinic.name}
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('new')}>
            <Plus size={18} strokeWidth={2.4} />
            {t('nav.new')}
          </button>
        </div>

        {/* Stat line */}
        <div className="mt-8 flex flex-wrap items-stretch gap-x-10 gap-y-4">
          <Stat value={data.round.length} label={t('today.readings')} delay={0.05} />
          <Divider />
          <Stat value={data.red} label={t('today.red')} band="red" delay={0.1} />
          <Divider />
          <Stat value={pending} label={t('today.pending')} delay={0.15} accent={pending > 0} />
        </div>

        {/* Sync banner */}
        {(pending > 0 || syncing) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mt-8 flex items-center gap-4 rounded-[16px] px-5 py-4"
            style={{
              background: state.online ? 'var(--accent-soft)' : 'var(--surface)',
              boxShadow: `inset 0 0 0 1px ${state.online ? 'oklch(from var(--accent) l c h / 0.3)' : 'var(--line-soft)'}`,
            }}
          >
            <span className={state.online ? 'text-accent-text' : 'text-fg-3'}>
              {syncing ? <Ring progress={sync.total ? sync.sent / sync.total : 0} size={22} stroke={2.5} /> : state.online ? <UploadCloud size={22} /> : <CloudOff size={22} />}
            </span>
            <p className="flex-1 text-[14px] text-fg-2">
              {state.online ? t('today.syncBanner', { n: pending }) : t('today.syncBannerOffline')}
            </p>
            {state.online && (
              <button className="btn btn-primary btn-sm" disabled={syncing} onClick={() => (portal ? void window.pahana.sync.now() : navigate('portal'))}>
                {portal ? t('sync.now') : t('nav.portal')}
              </button>
            )}
          </motion.div>
        )}

        <div className="mt-10 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-10">
          {/* Today's round */}
          <section>
            <SectionHead title={t('today.round')} count={data.round.length} />
            {data.round.length === 0 ? (
              <Empty text={t('today.roundEmpty')} />
            ) : (
              <div className="flex flex-col">
                {data.round.slice(0, 14).map(({ v, r }, i) => {
                  const isLatest = v.latest?.id === r.id
                  const band = isLatest ? v.triage?.band : null
                  return (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + Math.min(i, 10) * 0.025, duration: 0.3 }}
                      onClick={() => navigate('patients', { patientId: v.patient.id })}
                      className="row-hover -mx-3 flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left"
                    >
                      <span className="mono w-12 flex-none text-[12px] text-fg-4">{timeOfDay(r.takenAt)}</span>
                      <Avatar name={v.patient.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold">{v.patient.name}</div>
                        <div className="truncate text-[12px] text-fg-3">
                          <span className="mono">#{v.patient.code}</span> · {v.patient.area}
                        </div>
                      </div>
                      <span className="tnum hidden text-[13px] text-fg-2 xl:inline">
                        {r.sys ? `${r.sys}/${r.dia}` : ''}
                        {r.glucose ? <span className="ml-2 text-fg-3">{r.glucoseType === 'fasting' ? 'FBS' : 'RBS'} {r.glucose}</span> : null}
                      </span>
                      <span className="w-[92px] flex-none text-right">{band && <BandChip band={band} lang={lang} size="sm" />}</span>
                      <span className="w-4 flex-none" title={r.syncedAt ? t('pt.synced') : t('pt.notSynced')}>
                        {!r.syncedAt && <span className="block h-2 w-2 rounded-full bg-accent" />}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-10">
            {/* From the clinic */}
            <section>
              <SectionHead title={t('today.fromClinic')} />
              {data.decisions.length === 0 ? (
                <Empty text={t('today.fromClinicEmpty')} />
              ) : (
                <div className="flex flex-col gap-1">
                  {data.decisions.map(({ d, v }) => (
                    <button
                      key={d.id}
                      onClick={() => v && navigate('patients', { patientId: v.patient.id })}
                      className="row-hover -mx-3 flex items-start gap-3 rounded-[12px] px-3 py-2.5 text-left"
                    >
                      <span className="mt-[5px]">
                        <BandMark band={d.band} size={9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{ACTION_LABEL[d.action][lang]}</div>
                        <div className="truncate text-[12px] text-fg-3">
                          {v?.patient.name} · {d.decidedBy}
                        </div>
                      </div>
                      <MessageSquareText size={14} className="mt-1 flex-none text-fg-4" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Due */}
            <section>
              <SectionHead title={t('today.due')} count={data.due.length} />
              {data.due.length === 0 ? (
                <Empty text={t('today.dueEmpty')} />
              ) : (
                <div className="flex flex-col gap-1">
                  {data.due.map((v) => (
                    <button
                      key={v.patient.id}
                      onClick={() => navigate('new', { patientId: v.patient.id })}
                      className="row-hover -mx-3 flex items-center gap-3 rounded-[12px] px-3 py-2 text-left"
                    >
                      <Avatar name={v.patient.name} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{v.patient.name}</div>
                        <div className="truncate text-[12px] text-fg-3">
                          {t('today.daysAgo', { n: Math.round((Date.now() - Date.parse(v.latest!.takenAt)) / DAY_MS) })}
                        </div>
                      </div>
                      <Plus size={15} className="text-fg-4" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label, band, accent, delay }: { value: number; label: string; band?: 'red'; accent?: boolean; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <div className="flex items-center gap-2.5">
        {band && <BandMark band={band} size={14} />}
        <span
          className="display tnum text-[40px] leading-none font-[640] tracking-[-0.03em]"
          style={{ color: band && value ? 'var(--red-text)' : accent ? 'var(--accent-text)' : 'var(--text)' }}
        >
          {value}
        </span>
      </div>
      <div className="mt-2 text-[13px] font-semibold text-fg-3">{label}</div>
    </motion.div>
  )
}

function Divider() {
  return <div className="w-px self-stretch bg-line-soft" />
}

export function SectionHead({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="section-title">{title}</h3>
      {count != null && <span className="tnum text-[13px] font-semibold text-fg-4">{count}</span>}
      <div className="flex-1" />
      {action}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-[13.5px] text-fg-3">{text}</p>
}
