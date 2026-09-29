import { AnimatePresence, motion } from 'motion/react'
import { CloudUpload, IdCard, MessageSquareText, Plus, Printer, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { maskPhone, relativeTime, shortDate } from '@shared/format'
import { ACTION_LABEL } from '@shared/messages'
import { formatReason } from '@shared/reasons'
import { CONDITION_LABEL, LANG_NAME, symptomList } from '@shared/symptoms'
import { triage } from '@shared/triage'
import { BandChip, BandMark } from '@ui/Band'
import { Segmented } from '@ui/controls'
import { TrendCharts } from '@ui/TrendChart'
import { useT } from '../i18n'
import { useField, useIndex, type PatientView } from '../store'
import { Avatar } from './NewReading'
import { SectionHead } from './Today'

type Filter = 'all' | 'pending' | 'red' | 'amber'

export function Patients() {
  const { t } = useT()
  const idx = useIndex()
  const params = useField((s) => s.params)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(params.patientId ?? null)

  useEffect(() => {
    if (params.patientId) setSelected(params.patientId)
  }, [params.patientId])

  const list = useMemo(() => {
    if (!idx) return []
    const query = q.trim().toLowerCase().replace(/^#/, '')
    return idx.patients
      .filter((v) => {
        if (filter === 'pending' && v.pending === 0) return false
        if ((filter === 'red' || filter === 'amber') && v.triage?.band !== filter) return false
        if (!query) return true
        return v.patient.name.toLowerCase().includes(query) || v.patient.code.includes(query) || v.patient.cardId.toLowerCase().includes(query)
      })
      .sort((a, b) => Date.parse(b.latest?.takenAt ?? b.patient.createdAt) - Date.parse(a.latest?.takenAt ?? a.patient.createdAt))
  }, [idx, q, filter])

  const view = selected ? idx?.byId.get(selected) : undefined

  return (
    <div className="grid h-full grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-r border-line-soft">
        <div className="flex flex-col gap-3 px-4 pt-2 pb-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-4" />
            <input className="input pl-9" placeholder={t('pt.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            className="w-full"
            options={[
              { value: 'all', label: t('pt.all') },
              { value: 'pending', label: t('pt.pending') },
              { value: 'red', label: <BandMark band="red" size={9} />, title: 'Red' },
              { value: 'amber', label: <BandMark band="amber" size={9} />, title: 'Amber' },
            ]}
          />
          <div className="text-[12px] font-semibold text-fg-4">{t('pt.count', { n: list.length })}</div>
        </div>
        <div className="scroll min-h-0 flex-1 px-2 pb-4">
          {list.map((v) => (
            <button
              key={v.patient.id}
              onClick={() => setSelected(v.patient.id)}
              className={`relative flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-100 ${
                selected === v.patient.id ? 'bg-surface shadow-[inset_0_0_0_1px_var(--line-soft)]' : 'hover:bg-[oklch(from_var(--surface)_l_c_h/0.55)]'
              }`}
            >
              <Avatar name={v.patient.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{v.patient.name}</div>
                <div className="truncate text-[12px] text-fg-3">
                  <span className="mono">#{v.patient.code}</span> · {v.latest ? relativeTime(v.latest.takenAt) : '—'}
                </div>
              </div>
              {v.pending > 0 && <CloudUpload size={14} className="text-accent-text" />}
              {v.triage && <BandMark band={v.triage.band} size={10} />}
            </button>
          ))}
          {!list.length && <p className="px-3 py-6 text-[13.5px] text-fg-3">{t('pt.none')}</p>}
        </div>
      </div>
      <div className="scroll min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          {view ? (
            <motion.div
              key={view.patient.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <PatientDetail view={view} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid h-full place-items-center p-10 text-fg-3">
              {t('pt.empty')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function PatientDetail({ view }: { view: PatientView }) {
  const { t, lang } = useT()
  const navigate = useField((s) => s.navigate)
  const { patient, readings, triage: tri, decisions } = view
  const reversed = readings.slice().reverse()

  return (
    <div className="px-8 pt-2 pb-12">
      <div className="flex items-start gap-4">
        <Avatar name={patient.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[28px]">{patient.name}</h2>
            <span className="mono text-fg-3">#{patient.code}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fg-3">
            <span>
              {patient.age} {t('common.years')} · {patient.sex === 'F' ? t('reg.female') : t('reg.male')}
            </span>
            <span>{patient.area}</span>
            <span>{LANG_NAME[patient.lang]}</span>
            {patient.phone && <span className="tnum">{maskPhone(patient.phone)}</span>}
            {patient.conditions.map((c) => (
              <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
                {CONDITION_LABEL[c][lang]}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[12.5px] text-fg-4">
            {t('pt.registered', { date: shortDate(patient.createdAt, lang) })} · <span className="mono">{patient.cardId}</span> ·{' '}
            {patient.syncedAt ? t('pt.synced') : t('pt.notSynced')}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('cards', { patientId: patient.id })}>
            <IdCard size={15} />
            {t('pt.card')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('new', { patientId: patient.id })}>
            <Plus size={15} />
            {t('pt.newReading')}
          </button>
        </div>
      </div>

      {tri && (
        <div data-band={tri.band} className="band-surface mt-7 rounded-[16px] px-5 py-4">
          <div className="flex items-center gap-3">
            <BandChip band={tri.band} lang={lang} meaning />
            <span className="text-[12.5px] text-fg-3">{view.latest && relativeTime(view.latest.takenAt)}</span>
          </div>
          <ul className="mt-3 grid gap-1.5">
            {tri.reasons
              .filter((r) => r.band !== 'info')
              .map((r) => (
                <li key={r.code} className="flex items-start gap-2.5 text-[13.5px] text-fg-2">
                  <span className="mt-[5px]">{r.band !== 'info' && <BandMark band={r.band} size={8} />}</span>
                  {formatReason(r, lang)}
                </li>
              ))}
          </ul>
        </div>
      )}

      {readings.length > 1 && (
        <section className="mt-9">
          <SectionHead title={t('new.trend')} />
          <TrendCharts readings={readings} latestBand={tri?.band} animateKey={patient.id} />
        </section>
      )}

      <section className="mt-9">
        <SectionHead title={t('pt.readings')} count={readings.length} />
        <div className="overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_var(--line-soft)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-bold tracking-wide text-fg-4 uppercase">
                <th className="px-4 py-2.5 font-bold">{t('pt.date')}</th>
                <th className="px-2 py-2.5 font-bold">{t('pt.bp')}</th>
                <th className="px-2 py-2.5 font-bold">{t('pt.glucoseShort')}</th>
                <th className="px-2 py-2.5 font-bold">{t('new.symptoms')}</th>
                <th className="px-2 py-2.5 font-bold">{t('pt.missedShort')}</th>
                <th className="px-4 py-2.5 text-right font-bold" />
              </tr>
            </thead>
            <tbody>
              {reversed.map((r, i) => {
                const history = readings.filter((h) => Date.parse(h.takenAt) < Date.parse(r.takenAt))
                const b = triage(r, { history, conditions: patient.conditions, readingId: r.id }).band
                return (
                  <tr key={r.id} className="border-t border-line-soft">
                    <td className="px-4 py-2.5 whitespace-nowrap text-fg-2">{shortDate(r.takenAt, lang)}</td>
                    <td className="tnum px-2 py-2.5 font-semibold">{r.sys ? `${r.sys}/${r.dia}` : '—'}</td>
                    <td className="tnum px-2 py-2.5">
                      {r.glucose ? (
                        <>
                          {r.glucose} <span className="text-[11px] text-fg-4">{r.glucoseType === 'fasting' ? 'FBS' : 'RBS'}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-fg-3">{r.symptoms.length ? symptomList(r.symptoms, lang) : '—'}</td>
                    <td className="tnum px-2 py-2.5 text-fg-3">{r.missedDays || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {!r.syncedAt && <CloudUpload size={14} className="text-accent-text" />}
                        <BandMark band={b} size={9} />
                        {i === 0 && <span className="sr-only">latest</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-9">
        <SectionHead title={t('pt.decisions')} count={decisions.length} />
        {decisions.length === 0 ? (
          <p className="text-fg-3">{t('pt.noDecisions')}</p>
        ) : (
          <ol className="relative flex flex-col gap-5 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[4px] before:w-px before:bg-line-soft">
            {decisions.map((d) => (
              <li key={d.id} className="relative">
                <span className="absolute top-[6px] -left-5">
                  <BandMark band={d.band} size={9} />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{ACTION_LABEL[d.action][lang]}</span>
                  <span className="text-[12.5px] text-fg-4">
                    {shortDate(d.decidedAt, lang)} · {d.decidedBy}
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-2 rounded-[12px] bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-2 shadow-[inset_0_0_0_1px_var(--line-soft)]">
                  {d.message.channel === 'sms' ? (
                    <MessageSquareText size={14} className="mt-[3px] flex-none text-fg-4" />
                  ) : (
                    <Printer size={14} className="mt-[3px] flex-none text-fg-4" />
                  )}
                  <span className="selectable">{d.message.text}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
