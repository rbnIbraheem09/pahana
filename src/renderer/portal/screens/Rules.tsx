import { AlertTriangle } from 'lucide-react'
import { RULE_TABLE, RULES_VERSION } from '@shared/triage'
import type { Band } from '@shared/types'
import { BandMark } from '@ui/Band'

const ORDER: Band[] = ['red', 'amber', 'green']
const TITLE: Record<Band, string> = { red: 'Red · review first', amber: 'Amber · review soon', green: 'Green · stable, can skip the trip' }

/** Every flag is explainable: this page is the whole rulebook. */
export function Rules() {
  return (
    <div className="scroll h-full">
      <div className="mx-auto max-w-[900px] px-8 pt-8 pb-14">
        <h2 className="text-[28px]">Triage rules · v{RULES_VERSION}</h2>
        <p className="mt-3 max-w-[66ch] text-fg-2">
          Nexa Health uses fixed, published thresholds. It is not AI and it never diagnoses. The rules only decide the order in which a doctor reviews patients, and every flag
          in the queue names the exact rule that fired.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-amber-soft px-4 py-3 text-[13.5px] text-fg-2 shadow-[inset_0_0_0_1px_var(--amber-line)]">
          <AlertTriangle size={16} className="mt-[2px] flex-none text-amber" />
          Prototype thresholds based on WHO HEARTS, ISH 2020 and ADA targets. They must be checked against Sri Lanka Ministry of Health NCD guidelines and signed off by a clinical lead before any real use.
        </div>

        {ORDER.map((band) => (
          <section key={band} className="mt-10" data-band={band}>
            <div className="mb-3 flex items-center gap-2.5">
              <BandMark band={band} size={13} />
              <h3 className="section-title" style={{ color: 'var(--band-text)' }}>
                {TITLE[band]}
              </h3>
            </div>
            <div className="overflow-hidden rounded-[16px] shadow-[inset_0_0_0_1px_var(--line-soft)]">
              {RULE_TABLE.filter((r) => r.band === band).map((r, i) => (
                <div key={i} className="grid grid-cols-[140px_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 border-t border-line-soft px-5 py-3.5 text-[14px] first:border-0">
                  <span className="font-semibold text-fg-2">{r.area}</span>
                  <span>{r.rule}</span>
                  <span className="text-[13px] text-fg-3">{r.basis}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p className="mt-10 text-[13px] text-fg-3">
          Within a band, patients are ordered by a priority score: how far readings are past each threshold, the number and severity of symptoms, missed doses and
          rising trends. Ties go to whoever has waited longest.
        </p>
      </div>
    </div>
  )
}
