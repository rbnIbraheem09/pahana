import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, ExternalLink, Power, RadioTower, Users, Wifi } from 'lucide-react'
import { useState } from 'react'
import { QR } from '@ui/QR'
import { Switch } from '@ui/controls'
import { useT } from '../i18n'
import { useField } from '../store'

export function PortalHost() {
  const { t } = useT()
  const portal = useField((s) => s.portal)
  const requests = useField((s) => s.requests)
  const onLaunch = useField((s) => s.state?.settings.portalOnLaunch ?? false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (portal.running) await window.pahana.portal.stop()
      else await window.pahana.portal.start(portal.lan)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll h-full">
      <div className="screen-pad mx-auto max-w-[1100px]">
        <div
          className="relative overflow-hidden rounded-[22px] px-8 py-7 transition-[box-shadow] duration-300"
          style={{
            background: 'var(--surface)',
            boxShadow: portal.running ? 'inset 0 0 0 1px var(--green-line)' : 'inset 0 0 0 1px var(--line-soft)',
          }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={false}
            animate={{ opacity: portal.running ? 1 : 0 }}
            style={{ background: 'radial-gradient(80% 140% at 0% 0%, var(--green-soft), transparent 60%)' }}
          />
          <div className="relative flex items-center gap-5">
            <div
              className="grid h-14 w-14 flex-none place-items-center rounded-[18px] transition-colors duration-300"
              style={{
                background: portal.running ? 'var(--green-soft)' : 'var(--sunken)',
                color: portal.running ? 'var(--green)' : 'var(--text-4)',
              }}
            >
              <RadioTower size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[24px]">{t('portal.title')}</h2>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={String(portal.running)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold"
                    style={{
                      background: portal.running ? 'var(--green-soft)' : 'var(--sunken)',
                      color: portal.running ? 'var(--green-text)' : 'var(--text-3)',
                    }}
                  >
                    {portal.running && <span className="live-dot" />}
                    {portal.running ? t('portal.live') : t('portal.off')}
                  </motion.span>
                </AnimatePresence>
              </div>
              <p className="mt-1 max-w-[62ch] text-[13.5px] text-fg-3">{t('portal.lead')}</p>
            </div>
            <button className={`btn btn-lg ${portal.running ? 'btn-secondary' : 'btn-primary'}`} disabled={busy} onClick={toggle}>
              <Power size={17} />
              {portal.running ? t('portal.stop') : t('portal.start')}
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 px-2 text-[13.5px] text-fg-2">
          <Switch checked={onLaunch} onChange={(v) => void window.pahana.field.updateSettings({ portalOnLaunch: v })} label={t('portal.onLaunch')} />
          {t('portal.onLaunch')}
        </label>

        <AnimatePresence initial={false}>
          {portal.running && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
              className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10"
            >
              <div className="flex flex-col gap-8">
                <section>
                  <div className="eyebrow mb-3">{t('portal.open')}</div>
                  <div className="flex items-center gap-2">
                    <div className="mono flex h-11 min-w-0 flex-1 items-center truncate rounded-[12px] bg-sunken px-4 text-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
                      <span className="selectable truncate">{portal.localUrl}</span>
                    </div>
                    <button
                      className="btn btn-secondary btn-icon h-11 w-11"
                      title={t('portal.copy')}
                      onClick={() => {
                        void navigator.clipboard.writeText(portal.localUrl ?? '')
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1400)
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button className="btn btn-primary h-11" onClick={() => void window.pahana.portal.open()}>
                      <ExternalLink size={16} />
                      {t('portal.open')}
                    </button>
                  </div>
                </section>

                <section>
                  <div className="eyebrow mb-3">{t('portal.code')}</div>
                  <div className="flex gap-2">
                    {(portal.pairCode ?? '').split('').map((d, i) => (
                      <motion.span
                        key={`${portal.pairCode}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, type: 'spring', duration: 0.4, bounce: 0 }}
                        className="mono grid h-16 w-12 place-items-center rounded-[12px] bg-sunken text-[30px] font-bold shadow-[inset_0_0_0_1px_var(--line)]"
                      >
                        {d}
                      </motion.span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[12.5px] text-fg-4">{t('portal.codeHint')}</p>
                </section>

                <section className="flex items-center gap-3">
                  <Users size={16} className="text-fg-3" />
                  <span className="text-[13.5px] text-fg-2">{t('portal.viewers')}</span>
                  <span className="tnum display text-[20px] font-[650]">{portal.viewers}</span>
                </section>

                <section className="rounded-[18px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line-soft)]">
                  <div className="flex items-start gap-3">
                    <Wifi size={18} className="mt-0.5 text-fg-3" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t('portal.lan')}</div>
                      <p className="mt-0.5 text-[12.5px] text-fg-3">{t('portal.lanHint')}</p>
                    </div>
                    <Switch checked={portal.lan} onChange={(lan) => void window.pahana.portal.setLan(lan)} label={t('portal.lan')} />
                  </div>
                  <AnimatePresence initial={false}>
                    {portal.lan && portal.lanPairUrl && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-5 flex items-center gap-5">
                          <div className="rounded-[14px] bg-[oklch(0.99_0.003_258)] p-2.5">
                            <QR value={portal.lanPairUrl} size={132} fg="oklch(0.18 0.03 258)" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold">{t('portal.scan')}</div>
                            <div className="mono selectable mt-1.5 truncate text-[12.5px] text-fg-3">{portal.lanUrl}</div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>

              <section className="flex min-h-[420px] flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <span className="eyebrow">{t('portal.requests')}</span>
                  <span className="live-dot scale-75" />
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-sunken px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-soft)]">
                  {requests.length === 0 && <p className="text-[13px] text-fg-4">{t('portal.requestsEmpty')}</p>}
                  <div className="flex flex-col">
                    <AnimatePresence initial={false}>
                      {requests.slice(0, 22).map((r) => (
                        <motion.div
                          key={r.id}
                          layout="position"
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mono flex items-center gap-3 py-[3px] text-[12px]"
                        >
                          <span className="w-10 text-fg-4">{r.method}</span>
                          <span className="min-w-0 flex-1 truncate text-fg-2">{r.path}</span>
                          <span className={r.status < 400 ? 'text-green-text' : 'text-amber-text'}>{r.status}</span>
                          <span className="w-16 text-right text-fg-4">{r.ms} ms</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--sunken)] to-transparent" />
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
