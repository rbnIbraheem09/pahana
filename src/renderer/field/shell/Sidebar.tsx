import { motion, useAnimationControls } from 'motion/react'
import {
  ArrowUpDown,
  House,
  IdCard,
  Moon,
  PanelLeftClose,
  Plus,
  RadioTower,
  Settings as SettingsIcon,
  Sun,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import { initials } from '@shared/format'
import type { Lang } from '@shared/types'
import { Segmented, springSnappy } from '@ui/controls'
import { Wordmark } from '@ui/Logo'
import { useT, type StringKey } from '../i18n'
import { useField, useIndex, type Route } from '../store'

const NAV: { route: Route; icon: typeof House; key: StringKey; shortcut: string }[] = [
  { route: 'today', icon: House, key: 'nav.today', shortcut: '1' },
  { route: 'patients', icon: Users, key: 'nav.patients', shortcut: '3' },
  { route: 'sync', icon: ArrowUpDown, key: 'nav.sync', shortcut: '4' },
  { route: 'cards', icon: IdCard, key: 'nav.cards', shortcut: '5' },
  { route: 'portal', icon: RadioTower, key: 'nav.portal', shortcut: '6' },
]

export function Sidebar() {
  const { t, lang } = useT()
  const route = useField((s) => s.route)
  const navigate = useField((s) => s.navigate)
  const device = useField((s) => s.state?.device)
  const theme = useField((s) => s.state?.settings.theme ?? 'day')
  const portalLive = useField((s) => s.portal.running)
  const idx = useIndex()
  const mod = window.pahana.platform === 'darwin' ? '⌘' : 'Ctrl '

  return (
    <aside className="sidebar on-brand">
      <div className="sidebar-inner">
        <div className="sidebar-top drag">
          <button
            className="btn btn-ghost btn-icon"
            title={t('nav.collapse')}
            aria-label={t('nav.collapse')}
            onClick={() => useField.setState({ sidebarCollapsed: true })}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="px-4 pt-1 pb-5">
          <Wordmark sub="Field" />
        </div>

        <div className="px-3">
          <button
            onClick={() => navigate('new')}
            aria-current={route === 'new' ? 'page' : undefined}
            className="group relative flex h-10 w-full items-center gap-2.5 rounded-[10px] bg-accent px-3 text-[14px] font-[650] text-[color:var(--on-accent)] shadow-[inset_0_1px_0_oklch(1_0_0/0.16),0_1px_2px_oklch(0.1_0.03_258/0.3)] transition-[background-color,transform] duration-150 hover:bg-[color:var(--accent-hover)] active:scale-[0.98]"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span className="flex-1 text-left">{t('nav.new')}</span>
            <span className="text-[11.5px] font-semibold opacity-70">{mod}N</span>
          </button>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5 px-3" aria-label="Main">
          {NAV.map(({ route: r, icon: Icon, key, shortcut }) => {
            const active = route === r
            return (
              <button
                key={r}
                className="nav-item isolate"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(r)}
                title={`${t(key)}  ${mod}${shortcut}`}
              >
                <span className="nav-hover" />
                {active && <motion.span layoutId="nav-active" className="nav-active" transition={springSnappy} />}
                <Icon size={17} strokeWidth={2} />
                <span className="flex-1 truncate">{t(key)}</span>
                {r === 'sync' && <OutboxBadge count={idx?.pendingCount ?? 0} />}
                {r === 'portal' && portalLive && <span className="live-dot" />}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-3 px-3 pb-3">
          <Segmented<Lang>
            size="sm"
            ariaLabel={t('set.language')}
            value={lang}
            onChange={(v) => void window.pahana.field.updateSettings({ lang: v })}
            options={[
              { value: 'ta', label: <span style={{ fontFamily: "'Noto Sans Tamil Variable'" }}>தமிழ்</span>, title: 'தமிழ்' },
              { value: 'si', label: <span style={{ fontFamily: "'Noto Sans Sinhala Variable'" }}>සිංහල</span>, title: 'සිංහල' },
              { value: 'en', label: 'EN', title: 'English' },
            ]}
            className="w-full"
          />
          <div className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-1">
            <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-surface-2 text-[12px] font-bold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
              {initials(device?.workerName ?? '')}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold">{device?.workerName}</div>
              <div className="truncate text-[11.5px] text-fg-3">{device?.division} division</div>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              title={theme === 'day' ? t('set.night') : t('set.day')}
              aria-label={theme === 'day' ? t('set.night') : t('set.day')}
              onClick={() => void window.pahana.field.updateSettings({ theme: theme === 'day' ? 'night' : 'day' })}
            >
              <motion.span key={theme} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
                {theme === 'day' ? <Moon size={16} /> : <Sun size={16} />}
              </motion.span>
            </button>
            <button
              className="btn btn-ghost btn-icon"
              title={t('nav.settings')}
              aria-label={t('nav.settings')}
              aria-current={route === 'settings' ? 'page' : undefined}
              onClick={() => navigate('settings')}
            >
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function OutboxBadge({ count }: { count: number }) {
  const pulse = useField((s) => s.outboxPulse)
  const controls = useAnimationControls()
  useEffect(() => {
    if (pulse) void controls.start({ scale: [1, 1.35, 1], transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } })
  }, [pulse, controls])
  return (
    <motion.span
      data-flight-target="outbox"
      animate={controls}
      className={`tnum min-w-[22px] rounded-full px-1.5 text-center text-[11.5px] leading-[20px] font-bold transition-colors ${
        count ? 'bg-accent-soft text-accent-text' : 'text-fg-4'
      }`}
    >
      {count || ''}
    </motion.span>
  )
}
