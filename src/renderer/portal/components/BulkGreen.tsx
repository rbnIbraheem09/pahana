import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { Bus, Check, MessageSquareText, Printer, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { composeMessage } from '@shared/messages'
import { LANG_NAME } from '@shared/symptoms'
import type { Lang } from '@shared/types'
import { BandMark } from '@ui/Band'
import { api } from '../api'
import { usePortal, useQueue } from '../store'

const LANGS: Lang[] = ['ta', 'si', 'en']
const FONT: Record<Lang, string | undefined> = { en: undefined, si: "'Noto Sans Sinhala Variable'", ta: "'Noto Sans Tamil Variable'" }

/**
 * The "skip the trip" moment: every stable patient gets one SMS in their
 * own language, and nobody travels to a clinic just to hear "you're fine".
 */
export function BulkGreen() {
  const queue = useQueue('green')
  const clinic = usePortal((s) => s.clinic)!
  const toast = usePortal((s) => s.toast)
  const [phase, setPhase] = useState<'confirm' | 'sending' | 'done'>('confirm')
  const [count, setCount] = useState(0)
  const [snapshot, setSnapshot] = useState<{ sms: number; print: number } | null>(null)
  const [frozenLang, setFrozenLang] = useState<Record<Lang, number> | null>(null)

  const breakdown = useMemo(() => {
    const byLang: Record<Lang, number> = { ta: 0, si: 0, en: 0 }
    let sms = 0
    for (const s of queue) {
      byLang[s.lang]++
      if (s.phoneType) sms++
    }
    return { byLang, sms, print: queue.length - sms }
  }, [queue])

  const total = phase === 'confirm' ? queue.length : count
  // Freeze the numbers once sending starts (the live queue empties underneath).
  const shown = phase === 'confirm' ? { ...breakdown, total: queue.length } : { byLang: frozenLang ?? breakdown.byLang, sms: snapshot?.sms ?? 0, print: snapshot?.print ?? 0, total: count }

  const send = async () => {
    setSnapshot({ sms: breakdown.sms, print: breakdown.print })
    setFrozenLang(breakdown.byLang)
    setCount(queue.length)
    setPhase('sending')
    const res = await api.bulkGreen()
    setCount(res.count)
    setTimeout(() => {
      setPhase('done')
      toast({ tone: 'success', title: `${res.count} patients can skip the trip`, body: 'Messages sent in their own language' })
    }, 1500)
  }

  return (
    <div className="mx-auto max-w-[920px] px-10 pt-6 pb-14">
      <div className="flex items-center gap-2.5" data-band="green">
        <BandMark band="green" size={14} />
        <span className="eyebrow" style={{ color: 'var(--green-text)' }}>
          Stable patients
        </span>
      </div>

      {phase === 'done' ? (
        <DoneState count={count} breakdown={snapshot ?? breakdown} />
      ) : (
        <>
          <h2 className="mt-3 text-[34px] leading-tight font-[660]">
            {total.toLocaleString('en-GB')} patients can skip the trip
          </h2>
          <p className="mt-3 max-w-[64ch] text-[15px] text-fg-2">
            Their readings are within target and none reported warning symptoms. Each patient gets one message in their own language
            telling them to continue their medicine. There is no diagnosis and no numbers in it. Anyone without a phone gets a printed slip from their health worker.
          </p>

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
            <div>
              <div className="eyebrow mb-3">By language</div>
              <div className="flex flex-col gap-3">
                {LANGS.map((l) => (
                  <div key={l} className="grid grid-cols-[84px_minmax(0,1fr)_48px] items-center gap-3 text-[13.5px]">
                    <span className="font-semibold" style={{ fontFamily: FONT[l] }}>
                      {LANG_NAME[l]}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-sunken">
                      <motion.div
                        className="h-full rounded-full bg-green"
                        initial={{ width: 0 }}
                        animate={{ width: `${shown.total ? (shown.byLang[l] / shown.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="tnum text-right text-fg-2">{shown.byLang[l]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-3">Channel</div>
              <div className="flex gap-3">
                <Channel icon={<MessageSquareText size={16} />} label="SMS" value={shown.sms} />
                <Channel icon={<Printer size={16} />} label="Printed slip" value={shown.print} />
              </div>
            </div>
          </div>

          <div className="mt-9">
            <div className="eyebrow mb-3">What they receive</div>
            <div className="grid grid-cols-3 gap-3">
              {LANGS.map((l, i) => (
                <motion.div
                  key={l}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                  className="rounded-[16px] rounded-bl-[6px] bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]"
                  style={{ fontFamily: FONT[l] }}
                >
                  {composeMessage({ action: 'continue', lang: l, date: null, clinic, worker: '' })}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <button className="btn btn-primary btn-lg min-w-[240px]" disabled={phase === 'sending' || !queue.length} onClick={() => void send()}>
              <Send size={17} />
              {phase === 'sending' ? 'Sending' : `Send to ${shown.total.toLocaleString('en-GB')} patients`}
            </button>
            <button className="btn btn-ghost btn-lg" disabled={phase === 'sending'} onClick={() => usePortal.setState({ bulkOpen: false })}>
              Review individually
            </button>
          </div>
          {phase === 'sending' && <SendingBar total={count} />}
        </>
      )}
    </div>
  )
}

function Channel({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex-1 rounded-[16px] bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-soft)]">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-3">
        {icon}
        {label}
      </div>
      <div className="display tnum mt-1.5 text-[26px] font-[650]">{value}</div>
    </div>
  )
}

function SendingBar({ total }: { total: number }) {
  const n = useMotionValue(0)
  const rounded = useTransform(n, (v) => Math.round(v).toLocaleString('en-GB'))
  const width = useTransform(n, (v) => `${total ? (v / total) * 100 : 0}%`)
  useEffect(() => {
    const c = animate(n, total, { duration: 1.4, ease: [0.45, 0, 0.2, 1] })
    return () => c.stop()
  }, [n, total])
  return (
    <div className="mt-7">
      <div className="mb-2 flex items-baseline gap-2 text-[13.5px] text-fg-2">
        <motion.span className="tnum display text-[20px] font-[650] text-fg">{rounded}</motion.span>
        of {total.toLocaleString('en-GB')} messages queued
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <motion.div className="h-full rounded-full bg-green" style={{ width }} />
      </div>
    </div>
  )
}

function DoneState({ count, breakdown }: { count: number; breakdown: { sms: number; print: number } }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', duration: 0.6, bounce: 0 }}>
      <div className="mt-8 flex items-center gap-5">
        <motion.div
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{ background: 'var(--green-soft)', boxShadow: 'inset 0 0 0 1.5px var(--green-line)' }}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6, bounce: 0 }}
        >
          <Check size={38} strokeWidth={2.6} className="text-green" />
        </motion.div>
        <div>
          <div className="display tnum text-[56px] leading-none font-[680] tracking-[-0.03em] text-green-text">{count.toLocaleString('en-GB')}</div>
          <div className="mt-2 flex items-center gap-2 text-[15px] text-fg-2">
            <Bus size={17} /> trips to the clinic avoided
          </div>
        </div>
      </div>
      <p className="mt-8 max-w-[62ch] text-[15px] text-fg-2">
        {breakdown.sms.toLocaleString('en-GB')} SMS messages were sent and {breakdown.print} printed slips were queued for health workers. The clinic
        queue now holds only the patients who need a doctor.
      </p>
      <button className="btn btn-secondary mt-8" onClick={() => usePortal.getState().setBand('red')}>
        Back to red patients
      </button>
    </motion.div>
  )
}
