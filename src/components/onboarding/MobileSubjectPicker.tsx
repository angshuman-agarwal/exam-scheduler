import type { Subject } from '../../types'
import type { OnboardingController } from './useOnboardingController'
import QualificationChip from '../QualificationChip'
import SearchBar from './SearchBar'
import SubjectListItem from './SubjectListItem'
import { EMOJIS } from './ConfidenceRow'

interface MobileSubjectPickerProps {
  ctrl: OnboardingController
  onBack: () => void
}

function getSummaryLabel(
  subject: Subject,
  ctrl: OnboardingController,
): string | null {
  if (!ctrl.selectedSubjectIds.has(subject.id)) return null

  const oid = ctrl.chosenOffering.get(subject.id)
  if (!oid) return 'Needs setup'

  // Show full offering label (e.g. "AQA 8525") for consistency with desktop
  const subjectOffs = ctrl.offeringsBySubject.get(subject.id) || []
  const offering = subjectOffs.find(o => o.id === oid)
  const boardLabel = offering?.label ?? ctrl.getBoardDisplayName(oid)

  const conf = ctrl.confidences.get(oid)
  if (conf === undefined) return `${boardLabel} \u00B7 Needs confidence`

  const emoji = EMOJIS[Math.max(0, Math.min(4, conf - 1))]
  return `${boardLabel} \u00B7 ${emoji}`
}

export default function MobileSubjectPicker({ ctrl, onBack }: MobileSubjectPickerProps) {
  const selectedCount = ctrl.selectedSubjectIds.size
  const unconfiguredCount = ctrl.unconfiguredSelectedIds.length
  const allConfigured = selectedCount > 0 && unconfiguredCount === 0

  const handleFooterCta = () => {
    if (allConfigured) {
      ctrl.handleFinish()
    } else if (unconfiguredCount > 0) {
      // Navigate to first unconfigured
      ctrl.openSubjectConfig(ctrl.unconfiguredSelectedIds[0])
    }
  }

  const handleAddOwn = () => {
    ctrl.openWizard()
  }

  const handleCreateFromSearch = () => {
    ctrl.openWizard(ctrl.searchQuery.trim())
  }

  const hasResults = ctrl.filteredSubjects.length > 0
  const { authoritative: authoritativeMatches, suggestions: fuzzyMatches } = ctrl.searchNormalizedMatches
  const showCreateAction = !hasResults && ctrl.searchQuery.trim().length >= 3 && authoritativeMatches.length === 0

  return (
    <div className="flex flex-col min-h-screen bg-[#faf9f7]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#faf9f7] border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 shrink-0"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {ctrl.isEdit ? 'Update your subjects' : 'Pick your subjects'}
            </h1>
            {ctrl.studyMode && <QualificationChip mode={ctrl.studyMode} />}
          </div>
        </div>
        <SearchBar
          query={ctrl.searchQuery}
          onChange={ctrl.setSearchQuery}
          onAddOwn={handleAddOwn}
        />
      </div>

      {/* Subject lists */}
      <div className="flex-1 px-4 pt-3 pb-32">
        {/* Unified subject list */}
        {hasResults && (
          <div className="flex flex-col gap-2">
            {ctrl.filteredSubjects.map(s => (
              <SubjectListItem
                key={s.id}
                subject={s}
                isSelected={ctrl.selectedSubjectIds.has(s.id)}
                summaryLabel={getSummaryLabel(s, ctrl)}
                onTap={() => ctrl.openSubjectConfig(s.id)}
              />
            ))}
          </div>
        )}

        {/* A-Level empty state */}
        {ctrl.studyMode === 'alevel' && ctrl.seededSubjects.length === 0 && ctrl.customSubjects.length === 0 && !ctrl.searchQuery.trim() && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center mt-2">
            <p className="text-sm font-medium text-gray-600">We don't have built-in A-Level subjects yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add your own above to get started.</p>
          </div>
        )}

        {/* Search empty state */}
        {!hasResults && ctrl.searchQuery.trim() && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center mt-2">
            {authoritativeMatches.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-2">This subject already exists</p>
                {authoritativeMatches.map(m => (
                  <button
                    key={m.id}
                    onClick={() => ctrl.openAddBoard(m.id)}
                    className="block mx-auto mt-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Add board to {m.name}
                  </button>
                ))}
              </>
            ) : (
              <>
                {fuzzyMatches.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 mb-2">Did you mean one of these?</p>
                    {fuzzyMatches.map(m => (
                      <button
                        key={m.id}
                        onClick={() => ctrl.openAddBoard(m.id)}
                        className="block mx-auto mt-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Add board to {m.name}
                      </button>
                    ))}
                  </div>
                )}
                {fuzzyMatches.length === 0 && (
                  <p className="text-sm text-gray-500">No subjects match &ldquo;{ctrl.searchQuery.trim()}&rdquo;</p>
                )}
                {showCreateAction && (
                  <button
                    onClick={handleCreateFromSearch}
                    className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Create &ldquo;{ctrl.searchQuery.trim()}&rdquo;
                  </button>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden z-20">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {selectedCount > 0 && (
              <p className="text-sm text-gray-600 truncate">
                {selectedCount} selected
                {unconfiguredCount > 0 && (
                  <span className="text-amber-600"> {'\u00B7'} {unconfiguredCount} need setup</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleFooterCta}
            disabled={selectedCount === 0}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
              selectedCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : allConfigured
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700'
            }`}
          >
            {selectedCount === 0
              ? 'Pick subjects'
              : allConfigured
                ? (ctrl.isEdit ? 'Save changes' : 'Start studying')
                : 'Configure'}
          </button>
        </div>
      </div>
    </div>
  )
}
