import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { Sidebar } from './shell/Sidebar'
import { TopBar } from './shell/TopBar'
import { FlightLayer, Toasts } from './shell/Overlays'
import { useField, type Route } from './store'
import { translate } from './i18n'
import { Today } from './screens/Today'
import { NewReading } from './screens/NewReading'
import { Patients } from './screens/Patients'
import { SyncScreen } from './screens/Sync'
import { Cards } from './screens/Cards'
import { PortalHost } from './screens/PortalHost'
import { Settings } from './screens/Settings'
import type { AppCommand } from '../../preload/api'

const SCREENS: Record<Route, () => React.JSX.Element> = {
  today: Today,
  new: NewReading,
  patients: Patients,
  sync: SyncScreen,
  cards: Cards,
  portal: PortalHost,
  settings: Settings,
}

export function App() {
  const route = useField((s) => s.route)
  const collapsed = useField((s) => s.sidebarCollapsed)
  const theme = useField((s) => s.state?.settings.theme ?? 'day')
  const lang = useField((s) => s.state?.settings.lang ?? 'en')
  const fullscreen = useField((s) => s.win.fullscreen)
  const focused = useField((s) => s.win.focused)

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = theme
    el.dataset.fullscreen = String(fullscreen)
    el.dataset.windowFocused = String(focused)
    el.lang = lang
  }, [theme, fullscreen, focused, lang])

  useCommands()
  useSyncFeedback()

  const Screen = SCREENS[route]
  return (
    <div className="app" data-collapsed={collapsed}>
      <Sidebar />
      <main className="panel">
        <TopBar />
        <div className="panel-body">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route}
              className="screen"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </div>
        <Toasts />
      </main>
      <FlightLayer />
    </div>
  )
}

/** App commands: from the macOS menu bar, or keyboard shortcuts on Windows (which has no menu). */
function useCommands() {
  useEffect(() => {
    const run = (cmd: AppCommand) => {
      const { navigate, state, route } = useField.getState()
      const api = window.pahana
      switch (cmd) {
        case 'go:today':
          return navigate('today')
        case 'go:new':
          return navigate('new')
        case 'go:patients':
          return navigate('patients')
        case 'go:sync':
          return navigate('sync')
        case 'go:cards':
          return navigate('cards')
        case 'go:portal':
          return navigate('portal')
        case 'go:settings':
          return navigate('settings')
        case 'register':
          return navigate('new', { register: true })
        case 'sync':
          return void api.sync.now()
        case 'toggle-online':
          return void api.field.setOnline(!state?.online)
        case 'toggle-theme':
          return void api.field.updateSettings({ theme: state?.settings.theme === 'day' ? 'night' : 'day' })
      }
      void route
    }
    const off = window.pahana.app.onCommand(run)

    // Windows/Linux: the same shortcuts, handled in-page because there is no menu.
    const onKey = (e: KeyboardEvent) => {
      if (window.pahana.platform === 'darwin' || !e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const map: Record<string, AppCommand> = e.shiftKey
        ? { n: 'register', s: 'sync', o: 'toggle-online', l: 'toggle-theme' }
        : { '1': 'go:today', '2': 'go:new', '3': 'go:patients', '4': 'go:sync', '5': 'go:cards', '6': 'go:portal', n: 'go:new', ',': 'go:settings' }
      const cmd = map[k]
      if (cmd) {
        e.preventDefault()
        run(cmd)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      off()
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

/** Toasts for sync results and decisions arriving from the clinic. */
function useSyncFeedback() {
  useEffect(() => {
    let lastPhase = useField.getState().sync.phase
    const unsub = useField.subscribe((s) => {
      const { phase, lastResult, error } = s.sync
      if (phase === lastPhase) return
      lastPhase = phase
      const lang = s.state?.settings.lang ?? 'en'
      if (phase === 'done' && lastResult && lastResult.sent > 0) {
        s.toast({
          tone: 'success',
          title: translate(lang, 'sync.done', { n: lastResult.sent, ms: lastResult.ms }),
          body: s.state?.clinic.name,
        })
      }
      if (phase === 'error' && error) s.toast({ tone: 'error', title: translate(lang, 'sync.failed'), body: error })
    })
    const off = window.pahana.sync.onDecisions((n) => {
      const s = useField.getState()
      s.toast({ tone: 'info', title: translate(s.state?.settings.lang ?? 'en', 'sync.decisions', { n }), body: s.state?.clinic.doctor })
    })
    return () => {
      unsub()
      off()
    }
  }, [])
}
