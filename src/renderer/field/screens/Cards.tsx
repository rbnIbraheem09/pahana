import { motion } from 'motion/react'
import { Printer, RotateCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Patient } from '@shared/types'
import { NexaLettering, NexaMark } from '@ui/Logo'
import { QR } from '@ui/QR'
import { useT } from '../i18n'
import { useField, useIndex } from '../store'
import { Avatar } from './NewReading'

const BRING = {
  en: 'Bring this card to every visit',
  si: 'සෑම පැමිණීමකදීම මෙම කාඩ්පත රැගෙන එන්න',
  ta: 'ஒவ்வொரு வருகையிலும் இந்த அட்டையைக் கொண்டு வாருங்கள்',
}
const PRIVACY = {
  en: 'Random ID only. No medical information.',
  si: 'අහඹු අංකයක් පමණි. වෛද්‍ය තොරතුරු නැත.',
  ta: 'சீரற்ற எண் மட்டும். மருத்துவத் தகவல் இல்லை.',
}

export function Cards() {
  const { t } = useT()
  const idx = useIndex()
  const params = useField((s) => s.params)
  const clinic = useField((s) => s.state?.clinic.name ?? '')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(params.patientId ?? null)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (params.patientId) setSelected(params.patientId)
  }, [params.patientId])

  const list = useMemo(() => {
    if (!idx) return []
    const query = q.trim().toLowerCase().replace(/^#/, '')
    return idx.patients
      .filter((v) => !query || v.patient.name.toLowerCase().includes(query) || v.patient.code.includes(query))
      .sort((a, b) => a.patient.name.localeCompare(b.patient.name))
  }, [idx, q])

  const patient = (selected ? idx?.byId.get(selected) : list[0])?.patient

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-r border-line-soft">
        <div className="px-4 pt-2 pb-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-4" />
            <input className="input pl-9" placeholder={t('cards.choose')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="scroll min-h-0 flex-1 px-2 pb-4">
          {list.map((v) => (
            <button
              key={v.patient.id}
              onClick={() => {
                setSelected(v.patient.id)
                setFlipped(false)
              }}
              className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors duration-100 ${
                patient?.id === v.patient.id ? 'bg-surface shadow-[inset_0_0_0_1px_var(--line-soft)]' : 'hover:bg-[oklch(from_var(--surface)_l_c_h/0.55)]'
              }`}
            >
              <Avatar name={v.patient.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{v.patient.name}</div>
                <div className="mono text-[11.5px] text-fg-4">#{v.patient.code}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="scroll min-h-0">
        {patient && (
          <div className="flex min-h-full flex-col items-center justify-center gap-8 px-10 py-10">
            <button
              className="card-3d relative aspect-[85.6/54] w-full max-w-[520px] cursor-default"
              onClick={() => setFlipped((f) => !f)}
              aria-label={t('cards.flip')}
            >
              <motion.div
                className="relative h-full w-full"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: 'spring', duration: 0.8, bounce: 0 }}
              >
                <div className="card-face">
                  <CardFront patient={patient} clinic={clinic} />
                </div>
                <div className="card-face" style={{ transform: 'rotateY(180deg)' }}>
                  <CardBack patient={patient} />
                </div>
              </motion.div>
            </button>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary" onClick={() => setFlipped((f) => !f)}>
                <RotateCw size={16} />
                {t('cards.flip')}
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} />
                {t('cards.print')}
              </button>
            </div>
            <p className="flex max-w-[460px] items-start gap-2 text-center text-[13px] text-fg-3">
              <ShieldCheck size={15} className="mt-[2px] flex-none" />
              {t('cards.privacy')}
            </p>
          </div>
        )}
      </div>

      {/* Print layout: both faces at real card size */}
      {patient && (
        <div className="print-area hidden">
          <div className="print-card relative overflow-hidden">
            <CardFront patient={patient} clinic={clinic} />
          </div>
          <div className="print-card relative overflow-hidden">
            <CardBack patient={patient} />
          </div>
        </div>
      )}
    </div>
  )
}

function CardFront({ patient, clinic }: { patient: Patient; clinic: string }) {
  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden p-[6.5%] text-left"
      style={{
        background: 'radial-gradient(110% 90% at 100% 0%, oklch(0.5 0.17 250 / 0.55), transparent 62%), linear-gradient(160deg, oklch(0.33 0.12 264), oklch(0.21 0.075 265))',
        color: 'oklch(0.97 0.01 258)',
      }}
    >
      <div className="pointer-events-none absolute -top-[16%] -right-[8%] h-[78%] opacity-[0.09]" aria-hidden>
        <NexaMark size={400} className="h-full w-auto" />
      </div>
      <div className="relative flex items-center gap-[3%]">
        <NexaMark size={34} />
        <div className="leading-none">
          <NexaLettering height={24} />
          <div className="mt-1.5 text-[clamp(8px,1.8vw,10.5px)] font-bold tracking-[0.14em] uppercase opacity-70">Clinic card · සායන කාඩ්පත · கிளினிக் அட்டை</div>
        </div>
      </div>
      <div>
        <div className="display text-[clamp(18px,5.2vw,30px)] leading-tight font-[650] tracking-[-0.02em]">{patient.name}</div>
        <div className="mt-[2%] flex items-center gap-[4%] text-[clamp(10px,2.3vw,13.5px)] opacity-80">
          <span className="mono">#{patient.code}</span>
          <span>{clinic}</span>
        </div>
      </div>
      <div className="text-[clamp(7.5px,1.65vw,10px)] leading-[1.5] opacity-70">
        {BRING.en}
        <br />
        <span style={{ fontFamily: "'Noto Sans Sinhala Variable'" }}>{BRING.si}</span>
        <br />
        <span style={{ fontFamily: "'Noto Sans Tamil Variable'" }}>{BRING.ta}</span>
      </div>
    </div>
  )
}

function CardBack({ patient }: { patient: Patient }) {
  return (
    <div className="flex h-full w-full items-center gap-[6%] p-[6.5%] text-left" style={{ background: 'oklch(0.985 0.005 258)', color: 'oklch(0.24 0.06 264)' }}>
      <div className="aspect-square h-full flex-none rounded-[8%] bg-white p-[2.5%] shadow-[0_0_0_1px_oklch(0.8_0.01_258)]">
        <QR value={patient.cardId} size={400} className="h-full w-full" fg="oklch(0.2 0.06 264)" />
      </div>
      <div className="flex h-full min-w-0 flex-col justify-between py-[2%]">
        <div>
          <div className="text-[clamp(8px,1.8vw,10.5px)] font-bold tracking-[0.14em] uppercase opacity-55">Card ID</div>
          <div className="mono mt-1 text-[clamp(13px,3.2vw,19px)] font-bold tracking-[0.04em]">{patient.cardId}</div>
        </div>
        <div className="flex items-center gap-2">
          <NexaMark size={22} />
          <NexaLettering height={17} />
        </div>
        <div className="text-[clamp(7px,1.55vw,9.5px)] leading-[1.5] opacity-65">
          {PRIVACY.en}
          <br />
          <span style={{ fontFamily: "'Noto Sans Sinhala Variable'" }}>{PRIVACY.si}</span>
          <br />
          <span style={{ fontFamily: "'Noto Sans Tamil Variable'" }}>{PRIVACY.ta}</span>
        </div>
      </div>
    </div>
  )
}
