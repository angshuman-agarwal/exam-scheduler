import type { OnboardingController } from './useOnboardingController'
import SubjectConfigPanel from './SubjectConfigPanel'

interface MobileSubjectConfigProps {
  ctrl: OnboardingController
}

export default function MobileSubjectConfig({ ctrl }: MobileSubjectConfigProps) {
  const subjectId = ctrl.activeSubjectId
  if (!subjectId) return null

  const subject = ctrl.subjects.find(s => s.id === subjectId)
  if (!subject) return null

  const subjectOfferings = (ctrl.offeringsBySubject.get(subjectId) || []).filter(o => o.qualificationId === ctrl.studyMode)
  const chosenOid = ctrl.chosenOffering.get(subjectId) ?? null

  // Build board display names
  const boardDisplayNames = new Map<string, string>()
  for (const o of subjectOfferings) {
    boardDisplayNames.set(o.id, ctrl.getBoardDisplayName(o.id))
  }

  const paperList = chosenOid ? (ctrl.papersByOffering.get(chosenOid) || []) : []
  const confidence = chosenOid ? ctrl.confidences.get(chosenOid) : undefined

  // Figure out next unconfigured
  const unconfiguredIds = ctrl.unconfiguredSelectedIds.filter(id => id !== subjectId)
  const hasNextUnconfigured = unconfiguredIds.length > 0

  const handleBack = () => {
    ctrl.setActiveSubjectId(null)
    ctrl.setMobileStep('pick')
  }

  const handleNext = () => {
    if (hasNextUnconfigured) {
      ctrl.setActiveSubjectId(unconfiguredIds[0])
      // Stay in configure step, just switch subject
    } else {
      handleBack()
    }
  }

  const handleRemove = () => {
    ctrl.removeFromConfig(subjectId)
  }

  // Is current subject configured?
  const isCurrentConfigured = ctrl.configuredSubjectIds.has(subjectId)
  // Are all selected configured (including current)?
  const allConfigured = ctrl.selectedSubjectIds.size > 0 &&
    ctrl.unconfiguredSelectedIds.length === 0

  return (
    <div className="flex flex-col min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#faf9f7] border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 shrink-0"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
            <h2 className="text-lg font-bold text-gray-900 truncate">{subject.name}</h2>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pt-4 pb-32">
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <SubjectConfigPanel
            subject={subject}
            subjectOfferings={subjectOfferings}
            boardDisplayNames={boardDisplayNames}
            chosenOfferingId={chosenOid}
            onSelectOffering={(oid) => ctrl.selectOffering(subjectId, oid)}
            paperList={paperList}
            confidence={confidence}
            onSetConfidence={(level) => {
              if (chosenOid) ctrl.setConfidence(chosenOid, level)
            }}
            onRemove={handleRemove}
            showRemoveAction={true}
            offeringMeta={ctrl.offeringMeta}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden z-20">
        {isCurrentConfigured && hasNextUnconfigured ? (
          <button
            onClick={handleNext}
            className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 active:bg-amber-700 transition-colors"
          >
            Next subject
          </button>
        ) : isCurrentConfigured && allConfigured ? (
          <button
            onClick={handleBack}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Back to subjects
          </button>
        ) : (
          <button
            onClick={handleBack}
            className="w-full py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}
