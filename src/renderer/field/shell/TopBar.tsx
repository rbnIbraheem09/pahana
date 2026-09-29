import { AnimatePresence, motion } from 'motion/react'
import { Check, CloudOff, PanelLeftOpen, UploadCloud } from 'lucide-react'
import { longDate } from '@shared/format'
import { Ring } from '@ui/controls'
import { useT, type StringKey } from '../i18n'
import { useField, useIndex, type Route } from '../store'

const TITLE: Record<Route, StringKey> = {
  today: 'nav.today',
  new: 'nav.new',
  patients: 'nav.patients',
  sync: 'nav.sync',
  cards: 'nav.cards',
  portal: 'nav.portal',
  settings: 'nav.settings',
}

export function TopBar() {
  const { t, lang } = useT()
  const route = useField((s) => s.route)
  const collapsed = useField((s) => s.sidebarCollapsed)

  return (
    <header className="panel-top drag">
      {collapsed && (
        <motion.button
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="btn btn-ghost btn-icon -ml-1"
          title={t('nav.expand')}
          aria-label={t('nav.expand')}
          onClick={() => useField.setState({ sidebarCollapsed: false })}
        >
          <PanelLeftOpen size={17} />
        </motion.button>
      )}
      <div className="flex min-w-0 items-baseline gap-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={route + lang}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="truncate text-[17px] font-[650]"
          >
            {t(TITLE[route])}
          </motion.h1>
        </AnimatePresence>
        {route === 'today' && <span className="hidden truncate text-[13px] text-fg-3 lg:inline">{longDate(new Date(), lang)}</span>}
      </div>
      <div className="flex-1" />
      <SignalToggle />
      <SyncButton />
    </header>
  )
}

function SignalToggle() {
  const { t } = useT()
  const online = useField((s) => s.state?.online ?? false)
  return (
    <button
      onClick={() => void window.pahana.field.setOnline(!online)}
      title={t('signal.tip')}
      role="switch"
      aria-checked={online}
      className="relative flex h-[30px] items-center gap-2 rounded-full pr-3 pl-2.5 text-[12.5px] font-semibold transition-[background-color,color,box-shadow] duration-200"
      style={{
        background: online ? 'var(--green-soft)' : 'var(--surface)',
        color: online ? 'var(--green-text)' : 'var(--text-3)',
        boxShadow: online ? 'inset 0 0 0 1px var(--green-line)' : 'inset 0 0 0 1px var(--line)',
      }}
    >
      <SignalBars on={online} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(online)} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.14 }}>
          {online ? t('signal.online') : t('signal.offline')}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

function SignalBars({ on }: { on: boolean }) {
  return (
    <span className="relative flex h-[12px] items-end gap-[2px]" aria-hidden>
      {[4, 7, 10, 13].map((h, i) => (
        <motion.span
          key={h}
          className="w-[3px] rounded-[1.5px] bg-current"
          initial={false}
          animate={{ height: h - 1, opacity: on ? 1 : 0.28 }}
          transition={{ delay: on ? i * 0.07 : 0, duration: 0.2 }}
        />
      ))}
      {!on && (
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="absolute top-1/2 left-[-2px] h-[1.5px] w-[20px] origin-left -rotate-[35deg] rounded bg-current"
        />
      )}
    </span>
  )
}

function SyncButton() {
  const { t } = useT()
  const idx = useIndex()
  const sync = useField((s) => s.sync)
  const online = useField((s) => s.state?.online ?? false)
  const portal = useField((s) => s.portal.running)
  const navigate = useField((s) => s.navigate)
  const pending = idx?.pendingCount ?? 0
  const syncing = sync.phase === 'syncing'

  let state: 'syncing' | 'pending' | 'waiting' | 'done'
  if (syncing) state = 'syncing'
  else if (pending === 0) state = 'done'
  else if (!online) state = 'waiting'
  else state = 'pending'

  const onClick = () => {
    if (state === 'pending' && !portal) return navigate('portal')
    if (state === 'pending') return void window.pahana.sync.now()
    navigate('sync')
  }

  return (
    <button
      onClick={onClick}
      data-flight-target="sync-button"
      className="relative flex h-[30px] items-center gap-2 overflow-hidden rounded-full px-3 text-[12.5px] font-semibold transition-[background-color,color] duration-200"
      style={{
        background: state === 'pending' || state === 'syncing' ? 'var(--accent-soft)' : 'var(--surface)',
        color: state === 'pending' || state === 'syncing' ? 'var(--accent-text)' : 'var(--text-3)',
        boxShadow: state === 'pending' || state === 'syncing' ? 'inset 0 0 0 1px oklch(from var(--accent) l c h / 0.35)' : 'inset 0 0 0 1px var(--line)',
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {state === 'syncing' && (
            <>
              <Ring progress={sync.total ? sync.sent / sync.total : 0} size={14} />
              <span className="tnum">{t('sync.syncing', { sent: sync.sent, total: sync.total })}</span>
            </>
          )}
          {state === 'pending' && (
            <>
              <UploadCloud size={15} />
              <span className="tnum">{t('sync.pending', { n: pending })}</span>
            </>
          )}
          {state === 'waiting' && (
            <>
              <CloudOff size={15} />
              <span className="tnum">{t('sync.pending', { n: pending })}</span>
            </>
          )}
          {state === 'done' && (
            <>
              <Check size={15} />
              <span>{t('sync.upToDate')}</span>
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
