import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Languages, MessageSquareText, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isoDate, parseIsoDate } from '@shared/format'
import { ACTION_HINT, ACTION_LABEL, ACTION_NEEDS_DATE, ACTIONS, composeMessage, suggestedDate } from '@shared/messages'
import { LANG_NAME } from '@shared/symptoms'
import type { Band, DecisionAction, Lang, PatientSummary } from '@shared/types'
import { Ring } from '@ui/controls'
import { BasicPhone, Smartphone } from '@ui/Phone'
import { LampMark } from '@ui/Logo'
import { api } from '../api'
import { queues, usePortal } from '../store'

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function defaultDate(action: DecisionAction, band: Band): string {
  if (action === 'refer') return band === 'red' ? isoDate(new Date()) : suggestedDate(2)
  if (action === 'review') return suggestedDate(band === 'red' ? 1 : 3)
  return suggestedDate(2)
}

function dateOptions(): { value: string; label: string }[] {
  const today = new Date()
  const out = [
    { value: isoDate(today), label: 'Today' },
    { value: suggestedDate(1, today), label: 'Tomorrow' },
  ]
  const seen = new Set(out.map((o) => o.value))
  for (let i = 2; out.length < 6 && i < 12; i++) {
    const v = suggestedDate(i, today)
    if (seen.has(v)) continue
    seen.add(v)
    out.push({ value: v, label: DAY_FMT.format(parseIsoDate(v)) })
  }
  return out
}

export function DecisionPanel({ patientId }: { patientId: string }) {
  const s = usePortal((st) => st.summaries.get(patientId))
  if (!s) return null
  return <Panel key={patientId} s={s} />
}

function Panel({ s }: { s: PatientSummary }) {
  const clinic = usePortal((st) => st.clinic)!
  const band = s.triage?.band ?? 'green'
  const [action, setAction] = useState<DecisionAction | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [showEnglish, setShowEnglish] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done' | 'reviewed'>(s.awaiting ? 'idle' : 'reviewed')
  const [sent, setSent] = useState<{ text: string; lang: Lang; channel: 'sms' | 'print' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const indexAtDecision = useRef(0)
  const dates = useMemo(dateOptions, [])

  const worker = s.latest?.enteredBy && s.latest.enteredBy !== 'Clinic desk' ? s.latest.enteredBy : 'your health worker'
  const needsDate = action ? ACTION_NEEDS_DATE[action] : false
  const preview = action ? composeMessage({ action, lang: s.lang, date: needsDate ? date : null, clinic, worker }) : null
  const previewEn = action && s.lang !== 'en' ? composeMessage({ action, lang: 'en', date: needsDate ? date : null, clinic, worker }) : null

  const choose = (a: DecisionAction) => {
    setAction(a)
    setDate(ACTION_NEEDS_DATE[a] ? defaultDate(a, band) : null)
    setError(null)
  }

  const record = async () => {
    if (!action || phase !== 'idle') return
    setPhase('saving')
    const q = queues(usePortal.getState().summaries)[band]
    indexAtDecision.current = Math.max(0, q.findIndex((x) => x.id === s.id))
    try {
      const res = await api.decide({ patientId: s.id, action, scheduledFor: needsDate ? date : null, note })
      setSent({ text: res.decision.message.text, lang: res.decision.message.lang, channel: res.decision.message.channel })
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the decision')
      setPhase('idle')
    }
  }

  // Keyboard: 1–4 choose, ⌘/Ctrl+Enter records, N = next patient after recording.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea')
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void record()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (phase === 'idle' && ['1', '2', '3', '4'].includes(e.key)) choose(ACTIONS[Number(e.key) - 1])
      if (phase === 'done' && (e.key === 'n' || e.key === 'Enter')) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const next = () => {
    const st = usePortal.getState()
    const q = queues(st.summaries)[band]
    const target = q[Math.min(indexAtDecision.current, q.length - 1)]
    if (target) st.select(target.id)
  }

  if (phase === 'done') {
    return <Done s={s} sent={sent} onNext={next} />
  }

  if (phase === 'reviewed' && s.lastDecision) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <div className="eyebrow">Decision</div>
        <div className="rounded-[16px] bg-surface px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--line-soft)]">
          <div className="flex items-center gap-2 font-semibold">
            <Check size={16} className="text-green" />
            {ACTION_LABEL[s.lastDecision.action].en}
          </div>
          <div className="mt-1 text-[12.5px] text-fg-3">
            {s.lastDecision.decidedBy} · {new Date(s.lastDecision.decidedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button className="btn btn-secondary w-full" onClick={() => setPhase('idle')}>
          Record a new decision
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-6 pb-10">
      <div>
        <div className="eyebrow">Decision</div>
        <p className="mt-1 text-[13px] text-fg-3">The doctor decides. Pahana only orders the queue.</p>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Decision">
        {ACTIONS.map((a, i) => (
          <button key={a} role="radio" aria-checked={action === a} className="option" onClick={() => choose(a)}>
            <span className="option-key">{i + 1}</span>
            <span>
              <span className="block text-[14.5px] font-semibold">{ACTION_LABEL[a].en}</span>
              <span className="block text-[12px] text-fg-3">{ACTION_HINT[a]}</span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {action && needsDate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="field-label">{action === 'protocol' ? 'Health worker visits' : 'When'}</div>
            <div className="flex flex-wrap gap-1.5">
              {dates.map((d) => (
                <button key={d.value} className="date-chip" aria-pressed={date === d.value} onClick={() => setDate(d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {action && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <label>
              <span className="field-label">
                Note to health worker <span className="font-normal text-fg-4">· optional</span>
              </span>
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recheck BP after 5 minutes rest" />
            </label>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="field-label mb-0 flex items-center gap-1.5">
                  {s.phoneType ? <MessageSquareText size={14} /> : <Printer size={14} />}
                  Patient receives {s.phoneType ? 'an SMS' : 'a printed slip'}
                </span>
                {previewEn && (
                  <button className="btn btn-ghost btn-sm -mr-2" onClick={() => setShowEnglish((v) => !v)}>
                    <Languages size={14} />
                    {showEnglish ? LANG_NAME[s.lang] : 'English'}
                  </button>
                )}
              </div>
              <div
                className="rounded-[14px] bg-sunken px-4 py-3 text-[13.5px] leading-relaxed text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]"
                style={{ fontFamily: !showEnglish && s.lang === 'si' ? "'Noto Sans Sinhala Variable'" : !showEnglish && s.lang === 'ta' ? "'Noto Sans Tamil Variable'" : undefined }}
              >
                {showEnglish && previewEn ? previewEn : preview}
              </div>
              <p className="mt-2 text-[11.5px] text-fg-4">No diagnosis and no numbers are ever sent to the patient.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-[13px] text-red-text">{error}</p>}

      <button className="btn btn-primary btn-lg w-full" disabled={!action || (needsDate && !date) || phase === 'saving'} onClick={() => void record()}>
        {phase === 'saving' ? 'Recording' : 'Record decision'}
        <span className="text-[12px] font-semibold opacity-60">{navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl ↵'}</span>
      </button>
    </div>
  )
}

function Done({ s, sent, onNext }: { s: PatientSummary; sent: { text: string; lang: Lang; channel: 'sms' | 'print' } | null; onNext: () => void }) {
  const [countdown, setCountdown] = useState(sent ? 6 : 0)
  const [paused, setPaused] = useState(false)
  const band = s.triage?.band ?? 'green'
  const hasNext = queues(usePortal.getState().summaries)[band].length > 0

  useEffect(() => {
    if (!sent || paused || !hasNext) return
    if (countdown <= 0) return onNext()
    const t = setTimeout(() => setCountdown((c) => c - 0.1), 100)
    return () => clearTimeout(t)
  }, [countdown, paused, sent, onNext, hasNext])

  const lastAction = s.lastDecision?.action
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
      className="flex flex-col items-center gap-5 px-6 pt-6 pb-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="w-full rounded-[16px] px-4 py-3.5" style={{ background: 'var(--green-soft)', boxShadow: 'inset 0 0 0 1px var(--green-line)' }}>
        <div className="flex items-center gap-2 font-semibold text-green-text">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.4, bounce: 0 }}>
            <Check size={18} strokeWidth={2.8} />
          </motion.span>
          Decision recorded
        </div>
        <div className="mt-1 text-[12.5px] text-fg-2">
          {lastAction ? ACTION_LABEL[lastAction].en : 'Reviewed'} ·{' '}
          {sent ? (sent.channel === 'sms' ? 'SMS sent in ' + LANG_NAME[sent.lang] : 'Printed instruction for the health worker') : 'Reviewed'}
        </div>
      </div>

      {sent && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring', duration: 0.7, bounce: 0 }}>
          {sent.channel === 'print' ? (
            <PrintedSlip text={sent.text} lang={sent.lang} />
          ) : s.phoneType === 'smart' ? (
            <Smartphone text={sent.text} lang={sent.lang} scale={0.9} />
          ) : (
            <BasicPhone text={sent.text} lang={sent.lang} scale={0.92} />
          )}
        </motion.div>
      )}

      {hasNext ? (
        <button className="btn btn-primary btn-lg w-full" onClick={onNext}>
          {sent && !paused && <Ring progress={1 - countdown / 6} size={16} />}
          Next patient
          <ArrowRight size={17} />
        </button>
      ) : (
        <p className="text-center text-[13px] text-fg-3">That was the last one in this band.</p>
      )}
    </motion.div>
  )
}

function PrintedSlip({ text, lang }: { text: string; lang: Lang }) {
  return (
    <div
      className="w-[250px] rotate-[-1.5deg] rounded-[6px] px-5 py-5 text-[oklch(0.25_0.02_258)] shadow-[0_20px_40px_-18px_oklch(0.05_0.02_258/0.8)]"
      style={{ background: 'oklch(0.97 0.012 90)' }}
    >
      <div className="flex items-center gap-2 border-b border-dashed border-[oklch(0.7_0.02_90)] pb-3">
        <LampMark size={22} className="text-[oklch(0.25_0.03_258)]" />
        <span className="display text-[14px] font-[700]">Pahana · Clinic instruction</span>
      </div>
      <p
        className="mt-3 text-[12.5px] leading-relaxed"
        style={{ fontFamily: lang === 'si' ? "'Noto Sans Sinhala Variable'" : lang === 'ta' ? "'Noto Sans Tamil Variable'" : undefined }}
      >
        {text}
      </p>
      <div className="mt-4 text-[10px] tracking-wide text-[oklch(0.5_0.02_258)] uppercase">Handed over by your health worker</div>
    </div>
  )
}
