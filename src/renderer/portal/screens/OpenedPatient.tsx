import { ChevronLeft, ScanLine } from 'lucide-react'
import { DecisionPanel } from '../components/Decision'
import { Review } from '../components/Review'
import { usePortal } from '../store'

/** A single patient opened from the Patients list or by scanning a clinic card. */
export function OpenedPatient() {
  const id = usePortal((s) => s.openedId)
  const via = usePortal((s) => s.openedVia)
  const setView = usePortal((s) => s.setView)
  if (!id) return null
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(320px,380px)] max-[1100px]:grid-cols-1">
      <div className="scroll min-h-0">
        <div className="flex items-center gap-2 px-6 pt-4">
          <button className="btn btn-ghost btn-sm -ml-2" onClick={() => setView(via === 'scan' ? 'scan' : 'patients')}>
            <ChevronLeft size={15} />
            {via === 'scan' ? 'Scan another card' : 'All patients'}
          </button>
          {via === 'scan' && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-accent-text">
              <ScanLine size={13} /> Opened by clinic card
            </span>
          )}
        </div>
        <Review patientId={id} via={via} />
      </div>
      <div className="scroll min-h-0 shadow-[inset_1px_0_0_var(--line-soft)]">
        <DecisionPanel patientId={id} />
      </div>
    </div>
  )
}
