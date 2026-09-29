import { AnimatePresence, motion } from 'motion/react'
import { Building2, Check, CloudOff, Laptop, PowerOff, ShieldCheck } from 'lucide-react'
import { dateTime, relativeTime, timeOfDay } from '@shared/format'
import { BandMark } from '@ui/Band'
import { Switch } from '@ui/controls'
import { useT } from '../i18n'
import { indexOf, useField, useIndex } from '../store'
import { Avatar } from './NewReading'
import { Empty, SectionHead } from './Today'

type LinkState = 'offline' | 'server-off' | 'ready' | 'syncing' | 'synced'

export function SyncScreen() {
  const { t } = useT()
  const idx = useIndex()
  const state = useField((s) => s.state)!
  const sync = useField((s) => s.sync)
  const portal = useField((s) => s.portal.running)
  const navigate = useField((s) => s.navigate)
  if (!idx) return <div />

  const pending = idx.pendingCount
  const link: LinkState = !state.online
    ? 'offline'
    : !portal
      ? 'server-off'
      : sync.phase === 'syncing'
        ? 'syncing'
        : pending
          ? 'ready'
          : 'synced'

  const headline =
    link === 'offline'
      ? t('sync.noSignal')
      : link === 'server-off'
        ? t('sync.portalOff')
        : link === 'syncing'
          ? t('sync.syncing', { sent: sync.sent, total: sync.total })
          : pending
            ? t('sync.waitingN', { n: pending })
            : t('sync.allSynced')

  const outbox = idx.pendingReadings
    .slice()
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .map((r) => ({ r, v: indexOf(state).byId.get(r.patientId) }))

  return (
    <div className="scroll h-full">
      <div className="screen-pad mx-auto max-w-[1100px]">
        <div className="rounded-[22px] bg-surface px-8 pt-8 pb-7 shadow-[inset_0_0_0_1px_var(--line-soft)]">
          <LinkVisual state={link} portalOn={portal} progress={sync.total ? sync.sent / sync.total : 0} clinic={state.clinic.name} device={state.device.name} />
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={headline}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="tnum text-[24px]"
                >
                  {headline}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-fg-3">
                <ShieldCheck size={14} />
                {t('sync.signed')}
              </p>
            </div>
            {link === 'server-off' ? (
              <button className="btn btn-primary" onClick={() => navigate('portal')}>
                {t('portal.start')}
              </button>
            ) : (
              <button className="btn btn-primary" disabled={link !== 'ready'} onClick={() => void window.pahana.sync.now()}>
                {t('sync.now')}
              </button>
            )}
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-line-soft pt-5">
            <Switch
              checked={state.settings.autoSync}
              onChange={(autoSync) => void window.pahana.field.updateSettings({ autoSync })}
              label={t('sync.auto')}
            />
            <span className="text-[13.5px] text-fg-2">{t('sync.auto')}</span>
            <div className="flex-1" />
            <span className="text-[12.5px] text-fg-4">{t('sync.lastSync', { time: relativeTime(state.lastSyncAt) })}</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-10">
          <section>
            <SectionHead title={t('sync.outbox')} count={outbox.length} />
            {outbox.length === 0 ? (
              <Empty text={t('sync.outboxEmpty')} />
            ) : (
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {outbox.slice(0, 60).map(({ r, v }) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                      className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0"
                    >
                      <span className="mono w-12 text-[12px] text-fg-4">{timeOfDay(r.takenAt)}</span>
                      <Avatar name={v?.patient.name ?? '?'} size={28} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{v?.patient.name}</span>
                      <span className="tnum text-[12.5px] text-fg-3">
                        {r.sys ? `${r.sys}/${r.dia}` : ''} {r.glucose ? `· ${r.glucose}` : ''}
                      </span>
                      {v?.latest?.id === r.id && v.triage && <BandMark band={v.triage.band} size={9} />}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
          <section>
            <SectionHead title={t('sync.history')} />
            <div className="flex flex-col">
              {state.syncLog.slice(0, 12).map((e) => (
                <div key={e.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-0">
                  <span className={e.ok ? 'text-green' : 'text-red'}>{e.ok ? <Check size={15} /> : <CloudOff size={15} />}</span>
                  <span className="flex-1 text-fg-2">{dateTime(e.at)}</span>
                  <span className="tnum text-fg-3">
                    ↑{e.sent} {t('sync.sent')} · ↓{e.received} {t('sync.received')}
                  </span>
                  <span className="mono w-14 text-right text-[12px] text-fg-4">{e.ms} ms</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * Device ⟶ clinic link. Offline: broken grey line. Syncing: records travel
 * along the line as light. Synced: the clinic node glows once.
 */
function LinkVisual({
  state,
  portalOn,
  progress,
  clinic,
  device,
}: {
  state: LinkState
  portalOn: boolean
  progress: number
  clinic: string
  device: string
}) {
  const { t } = useT()
  const active = state === 'syncing'
  const ok = state === 'ready' || state === 'syncing' || state === 'synced'
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6">
      <Node icon={<Laptop size={24} />} title={t('sync.device')} sub={device} on />
      <div className="relative h-14">
        <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 20">
          <line
            x1="0"
            y1="10"
            x2="100"
            y2="10"
            stroke={ok ? 'var(--accent)' : 'var(--line-strong)'}
            strokeOpacity={ok ? 0.45 : 1}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={state === 'offline' ? '2 3' : undefined}
          />
        </svg>
        {state === 'offline' && (
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <CloudOff size={13} />
            {t('signal.offline')}
          </div>
        )}
        {active &&
          Array.from({ length: 6 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
              initial={{ left: '0%', opacity: 0 }}
              animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: [0.45, 0, 0.55, 1] }}
            />
          ))}
        {active && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-full bg-accent-soft">
            <motion.div className="h-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
          </div>
        )}
      </div>
      <Node
        icon={portalOn ? <Building2 size={24} /> : <PowerOff size={22} />}
        title={clinic}
        sub={portalOn ? t('portal.live') : t('portal.off')}
        on={portalOn}
        glow={state === 'synced'}
      />
    </div>
  )
}

function Node({ icon, title, sub, on, glow }: { icon: React.ReactNode; title: string; sub: string; on: boolean; glow?: boolean }) {
  return (
    <div className="flex w-[150px] flex-col items-center text-center">
      <motion.div
        className="relative grid h-16 w-16 place-items-center rounded-[20px]"
        style={{
          background: on ? 'var(--surface-2)' : 'var(--sunken)',
          color: on ? 'var(--text)' : 'var(--text-4)',
          boxShadow: `inset 0 0 0 1px ${on ? 'var(--line)' : 'var(--line-soft)'}`,
        }}
        animate={glow ? { boxShadow: ['inset 0 0 0 1px var(--line), 0 0 0 0 var(--green)', 'inset 0 0 0 1px var(--green-line), 0 0 0 10px oklch(from var(--green) l c h / 0)'] } : {}}
        transition={{ duration: 1.2 }}
      >
        {icon}
        {glow && (
          <span className="absolute -right-1.5 -bottom-1.5 grid h-6 w-6 place-items-center rounded-full bg-green text-[color:var(--panel)]">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </motion.div>
      <div className="mt-3 w-full truncate text-[13.5px] font-semibold">{title}</div>
      <div className="text-[12px] text-fg-3">{sub}</div>
    </div>
  )
}
