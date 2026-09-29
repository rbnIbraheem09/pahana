import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowRight, Check, HardDriveDownload, Lock, Search, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { initials, shortDate } from '@shared/format'
import { formatReason } from '@shared/reasons'
import { CONDITION_LABEL, SYMPTOM_LIST } from '@shared/symptoms'
import { triage } from '@shared/triage'
import type { Band, Condition, GlucoseType, Lang, NewPatientInput, Patient, SymptomKey } from '@shared/types'
import { BAND_MEANING, BAND_NAME, BandChip, BandMark } from '@ui/Band'
import { Segmented, Switch, spring } from '@ui/controls'
import { useT } from '../i18n'
import { indexOf, useField, useIndex, type PatientView } from '../store'

interface FormState {
  sys: string
  dia: string
  glucose: string
  glucoseType: GlucoseType
  symptoms: SymptomKey[]
  missedDays: number
  notes: string
}

const EMPTY: FormState = { sys: '', dia: '', glucose: '', glucoseType: 'fasting', symptoms: [], missedDays: 0, notes: '' }

const num = (s: string) => (s ? Number(s) : null)
const inRange = (v: number | null, lo: number, hi: number) => v == null || (v >= lo && v <= hi)

export function NewReading() {
  const params = useField((s) => s.params)
  const idx = useIndex()
  const [patientId, setPatientId] = useState<string | null>(params.patientId ?? null)
  const [registering, setRegistering] = useState(!!params.register)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saved, setSaved] = useState<{ name: string; patientId: string; band: Band | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const view = patientId ? idx?.byId.get(patientId) : undefined

  useEffect(() => {
    if (params.patientId) setPatientId(params.patientId)
    if (params.register) setRegistering(true)
  }, [params])

  const pick = (id: string) => {
    setPatientId(id)
    setRegistering(false)
    setSaved(null)
    setForm(EMPTY)
  }

  return (
    <div className="scroll h-full">
      <div className="screen-pad mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_minmax(300px,360px)] items-start gap-8">
        <LayoutGroup>
          <div className="flex min-w-0 flex-col gap-7">
            <AnimatePresence mode="popLayout" initial={false}>
              {registering ? (
                <RegisterForm key="reg" onCancel={() => setRegistering(false)} onDone={(p) => pick(p.id)} />
              ) : view ? (
                <PatientHeader key={`p-${view.patient.id}`} view={view} onChange={() => setPatientId(null)} />
              ) : (
                <PatientPicker key="pick" onPick={pick} onRegister={() => setRegistering(true)} />
              )}
            </AnimatePresence>
            {view && !registering && (
              <motion.div
                animate={{ opacity: saved ? 0.38 : 1 }}
                transition={{ duration: 0.3 }}
                onPointerDownCapture={() => saved && setSaved(null)}
              >
                <ReadingForm key={view.patient.id} form={form} setForm={setForm} onDirty={() => setSaved(null)} />
              </motion.div>
            )}
          </div>
        </LayoutGroup>
        <div className="sticky top-3">
          <PriorityCard
            view={registering ? undefined : view}
            form={form}
            saving={saving}
            saved={saved}
            onSave={async (rect) => {
              if (!view) return
              setSaving(true)
              const t = liveTriage(view, form)
              useField.getState().launch(rect, t?.band ?? null)
              await window.pahana.field.addReading({
                patientId: view.patient.id,
                sys: num(form.sys),
                dia: num(form.dia),
                glucose: num(form.glucose),
                glucoseType: form.glucoseType,
                symptoms: form.symptoms,
                missedDays: form.missedDays,
                notes: form.notes,
              })
              setSaving(false)
              setSaved({ name: view.patient.name.split(' ')[0], patientId: view.patient.id, band: t?.band ?? null })
              setForm(EMPTY)
            }}
            onAnother={() => setSaved(null)}
            onNext={() => {
              setSaved(null)
              setPatientId(null)
            }}
          />
        </div>
      </div>
    </div>
  )
}

function liveTriage(view: PatientView | undefined, form: FormState) {
  if (!view) return null
  const sys = num(form.sys)
  const dia = num(form.dia)
  const glucose = num(form.glucose)
  const bpComplete = sys != null && dia != null && sys >= 60 && dia >= 30
  const glOk = glucose != null && glucose >= 20
  if (!bpComplete && !glOk && !form.symptoms.length) return null
  return triage(
    {
      sys: bpComplete ? sys : null,
      dia: bpComplete ? dia : null,
      glucose: glOk ? glucose : null,
      glucoseType: form.glucoseType,
      symptoms: form.symptoms,
      missedDays: form.missedDays,
      takenAt: new Date().toISOString(),
    },
    { history: view.readings, conditions: view.patient.conditions },
  )
}

function validity(form: FormState) {
  const sys = num(form.sys)
  const dia = num(form.dia)
  const gl = num(form.glucose)
  const sysBad = !inRange(sys, 60, 260)
  const diaBad = !inRange(dia, 30, 160) || (sys != null && dia != null && dia >= sys)
  const glBad = !inRange(gl, 20, 600)
  const bpComplete = sys != null && dia != null
  const bpPartial = (sys != null) !== (dia != null)
  const ok = !sysBad && !diaBad && !glBad && !bpPartial && (bpComplete || gl != null)
  return { sysBad, diaBad, glBad, ok }
}

/* ------------------------------------------------------------------ */
/* Patient picker                                                      */
/* ------------------------------------------------------------------ */

function PatientPicker({ onPick, onRegister }: { onPick: (id: string) => void; onRegister: () => void }) {
  const { t } = useT()
  const idx = useIndex()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const results = useMemo(() => {
    if (!idx) return []
    const query = q.trim().toLowerCase().replace(/^#/, '')
    const list = idx.patients.filter((v) =>
      !query
        ? true
        : v.patient.name.toLowerCase().includes(query) || v.patient.code.includes(query) || v.patient.cardId.toLowerCase().includes(query),
    )
    return list
      .slice()
      .sort((a, b) => Date.parse(b.latest?.takenAt ?? b.patient.createdAt) - Date.parse(a.latest?.takenAt ?? a.patient.createdAt))
      .slice(0, 8)
  }, [idx, q])

  useEffect(() => setCursor(0), [q])

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={spring}
    >
      <h2 className="mb-1 text-[26px]">{t('new.choose')}</h2>
      <p className="mb-5 text-fg-3">{t('new.search')}</p>
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-4" />
        <input
          autoFocus
          className="input h-12 pl-10 text-[15.5px]"
          placeholder={t('new.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(results.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter' && results[cursor]) onPick(results[cursor].patient.id)
          }}
        />
      </div>
      <div className="mt-5 mb-2 flex items-center justify-between">
        <span className="eyebrow">{q ? `${results.length}` : t('new.recent')}</span>
        <button className="btn btn-ghost btn-sm" onClick={onRegister}>
          <UserPlus size={15} />
          {t('new.register')}
        </button>
      </div>
      <div className="flex flex-col">
        {results.map((v, i) => (
          <button
            key={v.patient.id}
            onClick={() => onPick(v.patient.id)}
            onMouseEnter={() => setCursor(i)}
            className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-100 ${i === cursor ? 'bg-surface' : ''}`}
          >
            <Avatar name={v.patient.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{v.patient.name}</div>
              <div className="truncate text-[12.5px] text-fg-3">
                <span className="mono">#{v.patient.code}</span> · {v.patient.area} · {v.patient.age}
                {v.patient.sex}
              </div>
            </div>
            {v.triage && <BandMark band={v.triage.band} size={10} />}
            <span className="w-16 text-right text-[12px] text-fg-4">{v.latest ? shortDate(v.latest.takenAt) : ''}</span>
          </button>
        ))}
        {!results.length && <div className="px-3 py-6 text-fg-3">{t('pt.none')}</div>}
      </div>
    </motion.section>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="grid flex-none place-items-center rounded-full bg-surface-2 font-bold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Patient header                                                      */
/* ------------------------------------------------------------------ */

function PatientHeader({ view, onChange }: { view: PatientView; onChange: () => void }) {
  const { t, lang } = useT()
  const { patient, latest } = view
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={spring}
      className="flex items-start gap-4"
    >
      <Avatar name={patient.name} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h2 className="truncate text-[26px]">{patient.name}</h2>
          <span className="mono text-[14px] text-fg-3">#{patient.code}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fg-3">
          <span>
            {patient.age} {t('common.years')} · {patient.sex === 'F' ? t('reg.female') : t('reg.male')}
          </span>
          <span>{patient.area}</span>
          {patient.conditions.map((c) => (
            <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
              {CONDITION_LABEL[c][lang]}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[13px] text-fg-3">
          {latest ? (
            <>
              {t('new.lastReading', { date: shortDate(latest.takenAt, lang) })}
              {': '}
              <span className="tnum font-semibold text-fg-2">
                {latest.sys ? `${latest.sys}/${latest.dia}` : ''}
                {latest.sys && latest.glucose ? ' · ' : ''}
                {latest.glucose ? `${latest.glucoseType === 'fasting' ? 'FBS' : 'RBS'} ${latest.glucose}` : ''}
              </span>
            </>
          ) : (
            t('new.firstReading')
          )}
        </div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onChange}>
        {t('new.change')}
      </button>
    </motion.section>
  )
}

/* ------------------------------------------------------------------ */
/* Reading form                                                        */
/* ------------------------------------------------------------------ */

function ReadingForm({
  form,
  setForm,
  onDirty,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onDirty: () => void
}) {
  const { t, lang } = useT()
  const sysRef = useRef<HTMLInputElement>(null)
  const diaRef = useRef<HTMLInputElement>(null)
  const glRef = useRef<HTMLInputElement>(null)
  const v = validity(form)
  const update = (patch: Partial<FormState>) => {
    onDirty()
    setForm((f) => ({ ...f, ...patch }))
  }
  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 3)

  useEffect(() => {
    sysRef.current?.focus()
  }, [])

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="flex flex-col gap-8">
      <Section label={t('new.bp')} unit="mmHg">
        <div className="flex items-start gap-3">
          <NumField
            ref={sysRef}
            label={t('new.sys')}
            value={form.sys}
            invalid={v.sysBad}
            placeholder="120"
            onChange={(s) => {
              update({ sys: digits(s) })
              if (digits(s).length === 3) diaRef.current?.focus()
            }}
            onKeyDown={(e) => {
              if (e.key === '/' || e.key === ' ') {
                e.preventDefault()
                diaRef.current?.focus()
              }
            }}
          />
          <span className="display mt-3 text-[38px] font-[300] text-fg-4">/</span>
          <NumField
            ref={diaRef}
            label={t('new.dia')}
            value={form.dia}
            invalid={v.diaBad}
            placeholder="80"
            onChange={(s) => {
              update({ dia: digits(s) })
              if (digits(s).length === 3) glRef.current?.focus()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !form.dia) sysRef.current?.focus()
              if (e.key === 'Enter') glRef.current?.focus()
            }}
          />
        </div>
        <AnimatePresence>
          {(v.sysBad || v.diaBad) && <Hint text={t('new.check')} />}
        </AnimatePresence>
      </Section>

      <Section label={t('new.glucose')} unit="mg/dL" hint={`· ${t('new.notMeasured')}`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-[132px]">
            <NumField
              ref={glRef}
              label={form.glucoseType === 'fasting' ? 'FBS' : 'RBS'}
              value={form.glucose}
              invalid={v.glBad}
              placeholder="110"
              onChange={(s) => update({ glucose: digits(s) })}
            />
          </div>
          <Segmented<GlucoseType>
            value={form.glucoseType}
            onChange={(g) => update({ glucoseType: g })}
            options={[
              { value: 'fasting', label: t('new.fasting') },
              { value: 'random', label: t('new.random') },
            ]}
            className="mt-[15px]"
          />
        </div>
        <AnimatePresence>{v.glBad && <Hint text={t('new.check')} />}</AnimatePresence>
      </Section>

      <Section label={t('new.symptoms')}>
        <div className="flex flex-wrap gap-2">
          {SYMPTOM_LIST.map((s) => {
            const on = form.symptoms.includes(s.key)
            return (
              <button
                key={s.key}
                className="chip"
                aria-pressed={on}
                data-severity={s.severity}
                onClick={() => update({ symptoms: on ? form.symptoms.filter((k) => k !== s.key) : [...form.symptoms, s.key] })}
              >
                {s.severity === 'urgent' && <BandMark band="red" size={8} />}
                {s.label[lang]}
                {on && <Check size={14} strokeWidth={2.6} />}
              </button>
            )
          })}
        </div>
      </Section>

      <Section label={t('new.missed')}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {Array.from({ length: 8 }, (_, d) => (
            <button
              key={d}
              role="radio"
              aria-checked={form.missedDays === d}
              onClick={() => update({ missedDays: d })}
              className={`relative h-10 rounded-[10px] text-[14px] font-bold transition-colors duration-150 ${d === 0 ? 'px-4' : 'w-10'} ${
                form.missedDays === d ? 'text-fg' : 'text-fg-3 hover:bg-surface hover:text-fg-2'
              }`}
            >
              {form.missedDays === d && (
                <motion.span
                  layoutId="missed-thumb"
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                  className="absolute inset-0 -z-0 rounded-[10px]"
                  style={{
                    background: d >= 3 ? 'var(--amber-soft)' : d > 0 ? 'var(--surface-2)' : 'var(--accent-soft)',
                    boxShadow: `inset 0 0 0 1.5px ${d >= 3 ? 'var(--amber)' : d > 0 ? 'var(--line-strong)' : 'var(--accent)'}`,
                  }}
                />
              )}
              <span className="relative">{d === 0 ? t('new.missedNone') : d}</span>
            </button>
          ))}
          <span className="ml-1 self-center text-[13px] text-fg-4">{t('new.days')}</span>
        </div>
      </Section>

      <Section label={t('new.notes')} hint={t('new.notesHint')}>
        <textarea
          className="input"
          rows={3}
          placeholder={t('new.notesPlaceholder')}
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </Section>
    </motion.div>
  )
}

function Section({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-[15px] font-[650] tracking-[-0.005em]" style={{ fontFamily: 'var(--font-ui)' }}>
          {label}
        </h3>
        {unit && <span className="text-[12px] font-semibold text-fg-4">{unit}</span>}
        {hint && <span className="text-[12px] text-fg-4">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden text-[12.5px] font-semibold text-amber-text"
    >
      <div className="pt-2">{text}</div>
    </motion.div>
  )
}

const NumField = ({
  ref,
  label,
  value,
  invalid,
  placeholder,
  onChange,
  onKeyDown,
}: {
  ref: React.Ref<HTMLInputElement>
  label: string
  value: string
  invalid?: boolean
  placeholder?: string
  onChange: (s: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) => (
  <label className="flex w-[132px] flex-col items-center gap-1.5">
    <input
      ref={ref}
      inputMode="numeric"
      className="num-input"
      aria-invalid={invalid}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
    <span className="text-center text-[12px] font-semibold text-fg-3">{label}</span>
  </label>
)

/* ------------------------------------------------------------------ */
/* Priority card (live triage) + save                                  */
/* ------------------------------------------------------------------ */

function PriorityCard({
  view,
  form,
  saving,
  saved,
  onSave,
  onAnother,
  onNext,
}: {
  view: PatientView | undefined
  form: FormState
  saving: boolean
  saved: { name: string; patientId: string; band: Band | null } | null
  onSave: (rect: DOMRect) => void
  onAnother: () => void
  onNext: () => void
}) {
  const { t, lang } = useT()
  const online = useField((s) => s.state?.online ?? false)
  const portal = useField((s) => s.portal.running)
  const result = liveTriage(view, form)
  const v = validity(form)
  const canSave = !!view && v.ok && !saving
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave && btnRef.current) {
        e.preventDefault()
        onSave(btnRef.current.getBoundingClientRect())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSave, onSave])

  const band = result?.band ?? null

  return (
    <div className="overflow-hidden rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--line-soft)]">
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
            className="flex flex-col items-center px-6 pt-10 pb-6 text-center"
          >
            <DrawCheck />
            <div className="mt-5 text-[19px] font-[650]" style={{ fontFamily: 'var(--font-display)' }}>
              {t('new.saved')}
            </div>
            <p className="mt-1.5 text-[13.5px] text-fg-3">{online && portal ? t('new.savedSync') : t('new.savedOffline')}</p>
            {saved.band && (
              <div className="mt-4">
                <BandChip band={saved.band} lang={lang} meaning />
              </div>
            )}
            <div className="mt-7 flex w-full flex-col gap-2">
              <button className="btn btn-primary btn-lg w-full" onClick={onNext}>
                {t('new.next')}
                <ArrowRight size={17} />
              </button>
              <button className="btn btn-secondary w-full" onClick={onAnother}>
                {t('new.another', { name: saved.name })}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="relative overflow-hidden px-6 pt-5 pb-6" data-band={band ?? undefined}>
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: band ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                style={{ background: 'linear-gradient(160deg, var(--band-soft), transparent 75%)' }}
              />
              <div className="relative">
                <div className="eyebrow">{t('new.priority')}</div>
                <div className="mt-3 flex min-h-[64px] items-center gap-3.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {band ? (
                      <motion.div
                        key={band}
                        className="flex items-center gap-3.5"
                        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
                      >
                        <BandMark band={band} size={26} />
                        <div>
                          <div className="display text-[34px] leading-none font-[680] tracking-[-0.02em]" style={{ color: 'var(--band-text)' }}>
                            {BAND_NAME[band][lang]}
                          </div>
                          <div className="mt-1 text-[13px] font-semibold text-fg-2">{BAND_MEANING[band][lang]}</div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p key="empty" className="text-[13.5px] text-fg-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {view ? t('new.priorityEmpty') : t('new.choose')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-2">
                    <div className="eyebrow mb-2">{t('new.why')}</div>
                    <ul className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {result.reasons
                          .filter((r) => r.band !== 'info')
                          .map((r) => (
                            <motion.li
                              key={r.code}
                              layout
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 6 }}
                              transition={{ duration: 0.22 }}
                              className="flex items-start gap-2.5 text-[13.5px] leading-snug text-fg-2"
                            >
                              <span className="mt-[5px]">{r.band !== 'info' && <BandMark band={r.band} size={8} />}</span>
                              <span>{formatReason(r, lang)}</span>
                            </motion.li>
                          ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-6 pt-4 pb-6">
              <p className="mb-4 text-[12px] leading-relaxed text-fg-4">{t('new.disclaimer')}</p>
              <button
                ref={btnRef}
                disabled={!canSave}
                onClick={() => btnRef.current && onSave(btnRef.current.getBoundingClientRect())}
                className="btn btn-primary btn-lg w-full"
              >
                <HardDriveDownload size={18} />
                {saving ? t('new.saving') : t('new.save')}
                <span className="ml-1 text-[12px] font-semibold opacity-60">{window.pahana.platform === 'darwin' ? '⌘↵' : 'Ctrl ↵'}</span>
              </button>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-fg-4">
                <Lock size={12} />
                {t('today.safe')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DrawCheck() {
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: 'var(--green-soft)', boxShadow: 'inset 0 0 0 1.5px var(--green-line)' }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
      />
      <svg width="30" height="30" viewBox="0 0 24 24" className="relative">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="var(--green)"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

function RegisterForm({ onCancel, onDone }: { onCancel: () => void; onDone: (p: Patient) => void }) {
  const { t, lang } = useT()
  const division = useField((s) => s.state?.device.division ?? '')
  const areas = useMemo(() => {
    const s = useField.getState().state
    return s ? Array.from(new Set(indexOf(s).patients.map((p) => p.patient.area))) : []
  }, [])
  const [f, setF] = useState<NewPatientInput & { consent: boolean }>({
    name: '',
    age: 0,
    sex: 'F',
    lang,
    phone: '',
    phoneType: 'basic',
    nic: '',
    area: division,
    conditions: [],
    consent: false,
  })
  const [busy, setBusy] = useState(false)
  const valid = f.name.trim().length >= 2 && f.age >= 18 && f.age <= 110 && f.conditions.length > 0 && f.consent
  const toggleCond = (c: Condition) =>
    setF((x) => ({ ...x, conditions: x.conditions.includes(c) ? x.conditions.filter((k) => k !== c) : [...x.conditions, c] }))

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={spring}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[26px]">{t('reg.title')}</h2>
        <button className="btn btn-ghost btn-icon" onClick={onCancel} aria-label={t('reg.cancel')}>
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_110px] gap-4">
        <label>
          <span className="field-label">{t('reg.name')}</span>
          <input autoFocus className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label>
          <span className="field-label">{t('reg.age')}</span>
          <input
            className="input tnum"
            inputMode="numeric"
            value={f.age || ''}
            onChange={(e) => setF({ ...f, age: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <span className="field-label">{t('reg.sex')}</span>
          <Segmented
            value={f.sex}
            onChange={(sex) => setF({ ...f, sex })}
            options={[
              { value: 'F', label: t('reg.female') },
              { value: 'M', label: t('reg.male') },
            ]}
          />
        </div>
        <div>
          <span className="field-label">{t('reg.lang')}</span>
          <Segmented<Lang>
            value={f.lang}
            onChange={(l) => setF({ ...f, lang: l })}
            options={[
              { value: 'ta', label: 'தமிழ்' },
              { value: 'si', label: 'සිංහල' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </div>
      <div>
        <span className="field-label">{t('reg.conditions')}</span>
        <div className="flex gap-2">
          {(['hypertension', 'diabetes'] as Condition[]).map((c) => (
            <button key={c} className="chip" aria-pressed={f.conditions.includes(c)} onClick={() => toggleCond(c)}>
              {CONDITION_LABEL[c][lang]}
              {f.conditions.includes(c) && <Check size={14} strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <label>
          <span className="field-label">
            {t('reg.phone')} <span className="font-normal text-fg-4">· {t('reg.phoneHint')}</span>
          </span>
          <input
            className="input tnum"
            inputMode="tel"
            placeholder="+94 7X XXX XXXX"
            value={f.phone ?? ''}
            onChange={(e) => setF({ ...f, phone: e.target.value.replace(/[^\d+\s]/g, '').slice(0, 16) })}
          />
        </label>
        <Segmented
          value={f.phoneType ?? 'basic'}
          onChange={(phoneType) => setF({ ...f, phoneType })}
          options={[
            { value: 'basic', label: t('reg.basic') },
            { value: 'smart', label: t('reg.smart') },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className="field-label">
            {t('reg.nic')} <span className="font-normal text-fg-4">· {t('reg.nicHint')}</span>
          </span>
          <input className="input mono" value={f.nic ?? ''} onChange={(e) => setF({ ...f, nic: e.target.value.toUpperCase().slice(0, 12) })} />
        </label>
        <label>
          <span className="field-label">{t('reg.area')}</span>
          <input className="input" list="areas" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
          <datalist id="areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-[14px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line-soft)]">
        <Switch checked={f.consent} onChange={(consent) => setF({ ...f, consent })} tone="green" label={t('reg.consent')} />
        <span className="text-[13.5px] leading-snug text-fg-2">{t('reg.consent')}</span>
      </label>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-lg"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true)
            const { consent: _c, ...input } = f
            const p = await window.pahana.field.register({ ...input, phone: input.phone || null, nic: input.nic || null })
            setBusy(false)
            onDone(p)
          }}
        >
          <UserPlus size={17} />
          {t('reg.submit')}
        </button>
        <button className="btn btn-ghost btn-lg" onClick={onCancel}>
          {t('reg.cancel')}
        </button>
      </div>
    </motion.section>
  )
}
