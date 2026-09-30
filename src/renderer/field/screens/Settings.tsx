import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RULE_TABLE, RULES_VERSION } from '@shared/triage'
import type { Lang, Theme } from '@shared/types'
import { BandMark } from '@ui/Band'
import { Segmented, Switch } from '@ui/controls'
import { useT } from '../i18n'
import { useField } from '../store'

export function Settings() {
  const { t, lang } = useT()
  const state = useField((s) => s.state)!
  const toast = useField((s) => s.toast)
  const [version, setVersion] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [profile, setProfile] = useState({
    workerName: state.device.workerName,
    workerRole: state.device.workerRole,
    division: state.device.division,
  })

  useEffect(() => {
    void window.pahana.app.info().then((i) => setVersion(i.version))
  }, [])

  const saveProfile = () => void window.pahana.field.updateProfile(profile)

  return (
    <div className="scroll h-full">
      <div className="screen-pad mx-auto flex max-w-[760px] flex-col gap-10">
        <Group title={t('set.worker')}>
          <div className="grid grid-cols-2 gap-4">
            <label className="col-span-2">
              <span className="field-label">{t('set.name')}</span>
              <input className="input" value={profile.workerName} onChange={(e) => setProfile({ ...profile, workerName: e.target.value })} onBlur={saveProfile} />
            </label>
            <label>
              <span className="field-label">{t('set.role')}</span>
              <input className="input" value={profile.workerRole} onChange={(e) => setProfile({ ...profile, workerRole: e.target.value })} onBlur={saveProfile} />
            </label>
            <label>
              <span className="field-label">{t('set.division')}</span>
              <input className="input" value={profile.division} onChange={(e) => setProfile({ ...profile, division: e.target.value })} onBlur={saveProfile} />
            </label>
          </div>
        </Group>

        <Group title={t('set.language')}>
          <Segmented<Lang>
            value={lang}
            onChange={(l) => void window.pahana.field.updateSettings({ lang: l })}
            options={[
              { value: 'ta', label: 'தமிழ்' },
              { value: 'si', label: 'සිංහල' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Group>

        <Group title={t('set.appearance')} hint={t('set.dayHint')}>
          <Segmented<Theme>
            value={state.settings.theme}
            onChange={(theme) => void window.pahana.field.updateSettings({ theme })}
            options={[
              { value: 'day', label: t('set.day') },
              { value: 'night', label: t('set.night') },
            ]}
          />
        </Group>

        <Group title={t('set.sync')}>
          <label className="flex items-center gap-3">
            <Switch checked={state.settings.autoSync} onChange={(autoSync) => void window.pahana.field.updateSettings({ autoSync })} label={t('sync.auto')} />
            <span className="text-fg-2">{t('sync.auto')}</span>
          </label>
        </Group>

        <Group title={t('set.demo')} hint={t('set.resetHint')}>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              {confirming ? (
                <motion.div key="confirm" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <span className="mr-1 font-semibold">{t('set.resetConfirm')}</span>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      await window.pahana.app.resetDemo()
                      setConfirming(false)
                      toast({ tone: 'success', title: t('set.resetDone') })
                    }}
                  >
                    <RotateCcw size={15} />
                    {t('set.reset')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                    {t('common.cancel')}
                  </button>
                </motion.div>
              ) : (
                <motion.button key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="btn btn-secondary" onClick={() => setConfirming(true)}>
                  <RotateCcw size={15} />
                  {t('set.reset')}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </Group>

        <Group title={`${t('set.rules')} · v${RULES_VERSION}`} hint={t('new.disclaimer')}>
          <div className="overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_var(--line-soft)]">
            {RULE_TABLE.map((r, i) => (
              <div key={i} className="grid grid-cols-[18px_110px_minmax(0,1fr)] items-start gap-3 border-t border-line-soft px-4 py-2.5 text-[13px] first:border-0">
                <span className="mt-[5px]">
                  <BandMark band={r.band} size={9} />
                </span>
                <span className="font-semibold text-fg-2">{r.area}</span>
                <span className="text-fg-2">
                  {r.rule}
                  <span className="block text-[12px] text-fg-4">{r.basis}</span>
                </span>
              </div>
            ))}
          </div>
        </Group>

        <Group title={t('set.about')}>
          <div className="text-[13.5px] text-fg-2">
            Nexa Health {version} · Rules v{RULES_VERSION}
          </div>
          <div className="mt-1 text-[13px] text-fg-4">{t('set.prototype')}</div>
        </Group>
      </div>
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="section-title">{title}</h3>
      {hint && <p className="mt-1 max-w-[62ch] text-[13px] text-fg-3">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
