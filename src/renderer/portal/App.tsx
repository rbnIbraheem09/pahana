import { AnimatePresence, motion } from 'motion/react'
import { Activity, BookOpenCheck, CheckCircle2, CloudDownload, Info, ListOrdered, Moon, ScanLine, Sun, Users } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { initials } from '@shared/format'
import { springSnappy } from '@ui/controls'
import { LampMark } from '@ui/Logo'
import { Pair } from './screens/Pair'
import { QueueWorkspace } from './screens/Queue'
import { PatientsTable } from './screens/PatientsTable'
import { OpenedPatient } from './screens/OpenedPatient'
const Scan = lazy(() => import('./screens/Scan').then((m) => ({ default: m.Scan })))
import { ActivityLog } from './screens/ActivityLog'
import { Rules } from './screens/Rules'
import { usePortal, type View } from './store'

const TABS: { view: View; label: string; icon: typeof Users }[] = [
  { view: 'queue', label: 'Review queue', icon: ListOrdered },
  { view: 'patients', label: 'Patients', icon: Users },
  { view: 'scan', label: 'Scan card', icon: ScanLine },
  { view: 'activity', label: 'Access log', icon: Activity },
  { view: 'rules', label: 'Rules', icon: BookOpenCheck },
]

export function App() {
  const phase = usePortal((s) => s.phase)
  const theme = usePortal((s) => s.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#edf0f6' : '#0b111c')
  }, [theme])

  return (
    <AnimatePresence mode="wait">
      {(phase === 'loading' || phase === 'unreachable') && (
        <motion.div key="loading" exit={{ opacity: 0 }} className="grid h-dvh place-items-center px-6">
          <div className="flex flex-col items-center text-center">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
              <LampMark size={44} className="text-fg" />
            </motion.div>
            <AnimatePresence>
              {phase === 'unreachable' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                  <h1 className="text-[22px]">Waiting for the clinic server</h1>
                  <p className="mt-2 max-w-[42ch] text-[14px] text-fg-3">
                    Switch on <b className="text-fg-2">Clinic portal</b> in Pahana on the clinic computer. This page reconnects by itself.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
      {phase === 'pair' && <Pair key="pair" />}
      {phase === 'ready' && <Shell key="shell" />}
    </AnimatePresence>
  )
}

function Shell() {
  const view = usePortal((s) => s.view)
  const setView = usePortal((s) => s.setView)
  const clinic = usePortal((s) => s.clinic)
  const actor = usePortal((s) => s.actor)
  const connection = usePortal((s) => s.connection)
  const theme = usePortal((s) => s.theme)
  const setTheme = usePortal((s) => s.setTheme)

  return (
    <motion.div
      className="portal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <header className="topbar">
        <div className="flex items-center gap-2.5">
          <LampMark size={28} className="text-fg" />
          <div className="leading-none">
            <div className="display text-[17px] font-[680] tracking-[-0.02em]">Pahana Clinic</div>
            <div className="mt-1 text-[11.5px] font-semibold text-fg-3">{clinic?.name}</div>
          </div>
        </div>

        <nav className="topbar-tabs isolate ml-4 flex items-center gap-1" aria-label="Sections">
          {TABS.map(({ view: v, label, icon: Icon }) => {
            const active = view === v || (v === 'patients' && view === 'patient')
            return (
              <button key={v} className="tab" aria-current={active ? 'page' : undefined} onClick={() => setView(v)}>
                {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={springSnappy} />}
                <Icon size={15} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={connection}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 text-[12.5px] font-semibold"
            style={{ color: connection === 'live' ? 'var(--green-text)' : 'var(--amber-text)' }}
            title={connection === 'live' ? 'Receiving updates in real time' : 'Connection lost. Retrying'}
          >
            {connection === 'live' ? (
              <span className="live-dot" />
            ) : (
              <motion.span className="h-2 w-2 rounded-full bg-amber" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            )}
            {connection === 'live' ? 'Live' : 'Reconnecting'}
          </motion.div>
        </AnimatePresence>

        <button
          className="btn btn-ghost btn-icon"
          aria-label={theme === 'day' ? 'Night theme' : 'Daylight theme'}
          title={theme === 'day' ? 'Night theme' : 'Daylight theme'}
          onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}
        >
          {theme === 'day' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-[12px] font-bold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
            {initials(actor.replace(/^Dr\.?\s*/, ''))}
          </div>
          <div className="hidden leading-tight xl:block">
            <div className="text-[13px] font-semibold">{actor}</div>
            <div className="text-[11.5px] text-fg-3">Medical officer</div>
          </div>
        </div>
      </header>

      <main className="stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="h-full"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {view === 'queue' && <QueueWorkspace />}
            {view === 'patients' && <PatientsTable />}
            {view === 'patient' && <OpenedPatient />}
            {view === 'scan' && (
              <Suspense fallback={null}>
                <Scan />
              </Suspense>
            )}
            {view === 'activity' && <ActivityLog />}
            {view === 'rules' && <Rules />}
          </motion.div>
        </AnimatePresence>
      </main>
      <PortalToasts />
    </motion.div>
  )
}

function PortalToasts() {
  const toasts = usePortal((s) => s.toasts)
  return (
    <div className="portal-toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-surface-2 py-2 pr-5 pl-3 text-[13.5px] shadow-[var(--pop-shadow)]"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full"
              style={{
                background: t.tone === 'success' ? 'var(--green-soft)' : 'var(--accent-soft)',
                color: t.tone === 'success' ? 'var(--green)' : 'var(--accent-text)',
              }}
            >
              {t.tone === 'sync' ? <CloudDownload size={15} /> : t.tone === 'success' ? <CheckCircle2 size={15} /> : <Info size={15} />}
            </span>
            <span className="font-semibold">{t.title}</span>
            {t.body && <span className="text-fg-3">{t.body}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
