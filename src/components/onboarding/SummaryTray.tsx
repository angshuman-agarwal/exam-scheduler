import type { Offering, Subject } from '../../types'
import { EMOJIS } from './ConfidenceRow'

export default function SummaryTray({
  subjects,
  selectedSubjectIds,
  chosenOffering,
  offeringsBySubject,
  confidences,
  boardMap,
  nearestExamByOffering,
  canFinish,
  onFinish,
  finishLabel,
  onCancel,
}: {
  subjects: Subject[]
  selectedSubjectIds: Set<string>
  chosenOffering: Map<string, string>
  offeringsBySubject: Map<string, Offering[]>
  confidences: Map<string, number>
  boardMap: Map<string, { id: string; name: string }>
  nearestExamByOffering: Map<string, { date: string; days: number }>
  canFinish: boolean
  onFinish: () => void
  finishLabel: string
  onCancel?: () => void
}) {
  const selectedSubjects = subjects.filter((s) => selectedSubjectIds.has(s.id))

  const missingConfidence = selectedSubjects.filter((s) => {
    const oid = chosenOffering.get(s.id)
    return !oid || !confidences.has(oid)
  })

  let nearestSubjectName: string | null = null
  let nearestDays = Infinity
  for (const s of selectedSubjects) {
    const oid = chosenOffering.get(s.id)
    if (!oid) continue
    const exam = nearestExamByOffering.get(oid)
    if (exam && exam.days < nearestDays) {
      nearestDays = exam.days
      nearestSubjectName = s.name
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {selectedSubjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">No subjects selected yet</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 mb-4">
            {selectedSubjects.map((s) => {
              const oid = chosenOffering.get(s.id)
              const subjectOfferings = offeringsBySubject.get(s.id) || []
              const off = oid ? subjectOfferings.find((o) => o.id === oid) : undefined
              const board = off ? boardMap.get(off.boardId) : undefined
              const conf = oid ? confidences.get(oid) : undefined
              return (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{s.name}</span>
                  {off ? (
                    <span className="text-xs text-gray-400 shrink-0">{board?.name} {off.spec}</span>
                  ) : (
                    <span className="text-xs text-gray-400 shrink-0">Pick board</span>
                  )}
                  {conf !== undefined ? (
                    <span className="text-sm leading-none shrink-0">{EMOJIS[Math.max(0, Math.min(4, conf - 1))]}</span>
                  ) : (
                    oid && <span className="text-xs text-amber-500 shrink-0 font-medium">rate confidence</span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="text-xs text-gray-400 mb-4">
            <span>{selectedSubjects.length} {selectedSubjects.length === 1 ? 'subject' : 'subjects'} selected</span>
            {nearestSubjectName && nearestDays < Infinity && (
              <span> {'\u00B7'} Nearest exam: {nearestSubjectName} in {nearestDays} {nearestDays === 1 ? 'day' : 'days'}</span>
            )}
          </div>
        </>
      )}
      <button
        onClick={onFinish}
        disabled={!canFinish}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {finishLabel}
      </button>
      {!canFinish && missingConfidence.length > 0 && (
        <p className="text-xs text-center text-amber-600 mt-2">
          {missingConfidence.length === 1
            ? `Rate your confidence for ${missingConfidence[0].name} to start studying`
            : `Rate your confidence for ${missingConfidence.length} subjects to start studying`}
        </p>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full py-3 mt-2 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
