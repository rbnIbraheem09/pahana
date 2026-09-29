import { motion } from 'motion/react'
import { Eye, MessageSquareText, Phone, Printer, ShieldCheck, Smartphone } from 'lucide-react'
import { dateTime, relativeTime, shortDate, timeOfDay } from '@shared/format'
import { ACTION_LABEL } from '@shared/messages'
import { formatReason } from '@shared/reasons'
import { CONDITION_LABEL, LANG_NAME, symptomList } from '@shared/symptoms'
import { THRESHOLDS } from '@shared/triage'
import type { Decision, PatientDetail, PatientSummary, Reading } from '@shared/types'
import { BandChip, BandMark } from '@ui/Band'
import { TrendCharts } from '@ui/TrendChart'
import { usePatientDetail } from '../hooks'
import { queues, usePortal } from '../store'

export function Review({ patientId, via }: { patientId: string; via: 'queue' | 'scan' | 'search' }) {
  const { detail, summary, error } = usePatientDetail(patientId, via)
  if (!summary) return null
  return (
    <motion.div
      key={patientId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="px-8 pt-3 pb-12"
    >
      <Header s={summary} detail={detail} />
      <ClinicalSummary s={summary} detail={detail} />
      {summary.triage && summary.triage.band !== 'green' && (
        <section className="mt-8">
          <h3 className="section-title mb-3">Why this patient is flagged</h3>
          <ul className="flex flex-col gap-2">
            {summary.triage.reasons
              .filter((r) => r.band !== 'info' && r.band !== 'green')
              .map((r) => (
                <li key={r.code} className="flex items-start gap-3 text-[14px] text-fg-2">
                  <span className="mt-[6px]">{r.band !== 'info' && <BandMark band={r.band} size={9} />}</span>
                  {formatReason(r)}
                </li>
              ))}
          </ul>
        </section>
      )}
      <section className="mt-9">
        <h3 className="section-title mb-4">Trend</h3>
        {detail ? (
          detail.readings.length > 1 ? (
            <TrendCharts readings={detail.readings} latestBand={summary.triage?.band} animateKey={patientId} />
          ) : (
            <p className="text-fg-3">First reading. No trend yet.</p>
          )
        ) : (
          <div className="grid gap-4">
            <div className="skeleton h-[150px]" />
            <div className="skeleton h-[150px]" />
          </div>
        )}
      </section>
      {detail && <Timeline detail={detail} />}
      {error && <p className="mt-6 text-red-text">{error}</p>}
      {detail && (
        <p className="mt-10 flex items-center gap-2 text-[12px] text-fg-4">
          <ShieldCheck size={14} />
          Opened by {detail.access[0]?.actor ?? 'you'} {detail.access[0] ? `at ${timeOfDay(detail.access[0].at)}` : ''}. Every access to this record is logged.
        </p>
      )}
    </motion.div>
  )
}

function Header({ s, detail }: { s: PatientSummary; detail: PatientDetail | null }) {
  const summaries = usePortal((st) => st.summaries)
  const q = s.triage ? queues(summaries)[s.triage.band] : []
  const rank = q.findIndex((x) => x.id === s.id)
  const p = detail?.patient
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {s.triage && <BandChip band={s.triage.band} meaning />}
        {s.awaiting && rank >= 0 && (
          <span className="text-[12.5px] font-semibold text-fg-3">
            Priority {rank + 1} of {q.length}
          </span>
        )}
        {!s.awaiting && s.lastDecision && <span className="text-[12.5px] font-semibold text-fg-3">Reviewed {relativeTime(s.lastDecision.decidedAt)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[30px] font-[660]">{s.name}</h2>
        <span className="mono text-[15px] text-fg-3">#{s.code}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-fg-3">
        <span>
          {s.age} y · {s.sex === 'F' ? 'Female' : 'Male'}
        </span>
        <span>{s.area}</span>
        <span>{LANG_NAME[s.lang]}</span>
        {p?.phoneMasked ? (
          <span className="tnum flex items-center gap-1">
            {s.phoneType === 'smart' ? <Smartphone size={13} /> : <Phone size={13} />}
            {p.phoneMasked}
          </span>
        ) : (
          p && (
            <span className="flex items-center gap-1">
              <Printer size={13} /> No phone
            </span>
          )
        )}
        <span className="mono text-fg-4">{s.cardId}</span>
        {s.conditions.map((c) => (
          <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
            {CONDITION_LABEL[c].en}
          </span>
        ))}
      </div>
    </div>
  )
}

function bpLabel(sys: number, dia: number) {
  const T = THRESHOLDS
  if (sys >= T.bpSevere.sys || dia >= T.bpSevere.dia) return 'Severe'
  if (sys >= T.bpGrade2.sys || dia >= T.bpGrade2.dia) return 'Elevated'
  if (sys >= T.bpTarget.sys || dia >= T.bpTarget.dia) return 'Above target'
  if (sys < T.bpLowSys) return 'Low'
  return 'Within target'
}

function glLabel(g: number, fasting: boolean) {
  if (g < 54) return 'Dangerously low'
  if (g < 70) return 'Low'
  if (g >= 300) return 'Very high'
  if (fasting ? g > 130 : g >= 180) return 'Above target'
  return 'Within target'
}

/** The five-line clinical picture from the original concept, made precise. */
function ClinicalSummary({ s, detail }: { s: PatientSummary; detail: PatientDetail | null }) {
  const l = s.latest
  const t = s.triage
  if (!l || !t) return null
  const bpBand = t.reasons.find((r) => r.code.startsWith('bp_'))?.band
  const glBand = t.reasons.find((r) => r.code.startsWith('gl_'))?.band
  const trend = t.trend
  const prevDecision = detail?.decisions.find((d) => d.readingId !== l.readingId)
  const tone = (b?: string) => (b === 'red' ? 'var(--red-text)' : b === 'amber' ? 'var(--amber-text)' : 'var(--text)')

  return (
    <section className="mt-7 rounded-[18px] bg-surface px-6 py-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
      <dl className="dl">
        <dt>Measurements</dt>
        <dd className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {l.sys != null && (
            <span>
              <span className="display tnum text-[22px] font-[650]" style={{ color: tone(bpBand) }}>
                {l.sys}/{l.dia}
              </span>{' '}
              <span className="text-[12.5px] text-fg-3">mmHg · {bpLabel(l.sys, l.dia!)}</span>
            </span>
          )}
          {l.glucose != null && (
            <span>
              <span className="display tnum text-[22px] font-[650]" style={{ color: tone(glBand) }}>
                {l.glucose}
              </span>{' '}
              <span className="text-[12.5px] text-fg-3">
                mg/dL {l.glucoseType === 'fasting' ? 'FBS' : 'RBS'} · {glLabel(l.glucose, l.glucoseType === 'fasting')}
              </span>
            </span>
          )}
        </dd>
        <dt>Trend</dt>
        <dd>
          {trend.direction === 'none'
            ? 'First reading'
            : trend.direction === 'up'
              ? 'Upward'
              : trend.direction === 'down'
                ? 'Downward'
                : 'Stable'}
          {trend.sysDelta != null && trend.direction !== 'none' && (
            <span className="tnum ml-2 text-[12.5px] text-fg-3">
              {trend.sysDelta > 0 ? '+' : ''}
              {trend.sysDelta} mmHg systolic vs recent visits
            </span>
          )}
        </dd>
        <dt>Symptoms</dt>
        <dd style={{ color: l.symptoms.length ? tone(t.reasons.find((r) => r.code.startsWith('sym_'))?.band) : undefined }}>
          {l.symptoms.length ? symptomList(l.symptoms).replace(/^./, (c) => c.toUpperCase()) : <span className="text-fg-3">None reported</span>}
        </dd>
        <dt>Medication adherence</dt>
        <dd>
          {l.missedDays ? (
            <span style={{ color: l.missedDays >= 3 ? 'var(--amber-text)' : undefined }}>Missed {l.missedDays} of the last 7 days</span>
          ) : (
            <span className="text-fg-2">Taking medication as prescribed</span>
          )}
        </dd>
        <dt>Previous decision</dt>
        <dd>
          {prevDecision ? (
            <>
              {prevDecision.action === 'continue' ? 'Routine (continue current plan)' : ACTION_LABEL[prevDecision.action].en}
              <span className="ml-2 text-[12.5px] text-fg-3">
                {shortDate(prevDecision.decidedAt)} · {prevDecision.decidedBy}
              </span>
            </>
          ) : detail ? (
            <span className="text-fg-3">None</span>
          ) : (
            <span className="skeleton inline-block h-4 w-40 align-middle" />
          )}
        </dd>
        <dt>Recorded</dt>
        <dd className="text-fg-2">
          {dateTime(l.takenAt)} by {l.enteredBy}
          {l.source === 'self' && <span className="ml-2 rounded bg-amber-soft px-1.5 text-[11px] font-bold text-amber-text">Unverified</span>}
        </dd>
      </dl>
    </section>
  )
}

function Timeline({ detail }: { detail: PatientDetail }) {
  type Row = { at: string; kind: 'reading'; r: Reading } | { at: string; kind: 'decision'; d: Decision }
  const rows: Row[] = [
    ...detail.readings.map((r) => ({ at: r.takenAt, kind: 'reading' as const, r })),
    ...detail.decisions.map((d) => ({ at: d.decidedAt, kind: 'decision' as const, d })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12)
  return (
    <section className="mt-9">
      <h3 className="section-title mb-4">History</h3>
      <ol className="relative flex flex-col gap-3.5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line-soft">
        {rows.map((row) =>
          row.kind === 'reading' ? (
            <li key={row.r.id} className="relative text-[13.5px]">
              <span className="absolute top-[7px] -left-6 h-[11px] w-[11px] rounded-full bg-panel shadow-[inset_0_0_0_2px_var(--line-strong)]" />
              <span className="text-fg-3">{shortDate(row.r.takenAt)}</span>
              <span className="tnum ml-3 font-semibold">
                {row.r.sys ? `${row.r.sys}/${row.r.dia}` : ''}
                {row.r.glucose ? `${row.r.sys ? ' · ' : ''}${row.r.glucoseType === 'fasting' ? 'FBS' : 'RBS'} ${row.r.glucose}` : ''}
              </span>
              {row.r.symptoms.length > 0 && <span className="ml-2 text-fg-3">· {symptomList(row.r.symptoms)}</span>}
              {row.r.notes && <div className="mt-1 text-[13px] text-fg-2 italic">“{row.r.notes}”</div>}
            </li>
          ) : (
            <li key={row.d.id} className="relative text-[13.5px]">
              <span className="absolute top-[6px] -left-6">
                <BandMark band={row.d.band} size={11} />
              </span>
              <span className="text-fg-3">{shortDate(row.d.decidedAt)}</span>
              <span className="ml-3 font-semibold">{ACTION_LABEL[row.d.action].en}</span>
              <span className="ml-2 text-fg-3">
                · {row.d.decidedBy}
                {row.d.bulk ? ' · bulk' : ''}
              </span>
              <span className="ml-2 inline-flex translate-y-[2px] text-fg-4" title={row.d.message.text}>
                {row.d.message.channel === 'sms' ? <MessageSquareText size={13} /> : <Printer size={13} />}
              </span>
            </li>
          ),
        )}
      </ol>
      {detail.access.length > 1 && (
        <p className="mt-5 flex items-center gap-2 text-[12px] text-fg-4">
          <Eye size={13} /> Opened {detail.access.length} times recently
        </p>
      )}
    </section>
  )
}
