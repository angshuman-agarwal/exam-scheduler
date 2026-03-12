import type { OnboardingController } from './useOnboardingController'
import QualificationChip from '../QualificationChip'
import SearchBar from './SearchBar'
import StatusBadge from './StatusBadge'
import SubjectConfigPanel from './SubjectConfigPanel'
import SummaryTray from './SummaryTray'
import type { Subject } from '../../types'

interface DesktopFlowProps {
  ctrl: OnboardingController
  onBack?: () => void
  showBackButton: boolean
  backLabel: string
  onCancel?: () => void
}

export default function DesktopFlow({ ctrl, onBack, showBackButton, backLabel, onCancel }: DesktopFlowProps) {
  const renderSubjectCard = (s: Subject) => {
    const isSelected = ctrl.selectedSubjectIds.has(s.id)
    const isExpanded = ctrl.expandedCards.has(s.id)
    const isCustom = s.id.startsWith('custom-subject-') || s.id.startsWith('draft-')
    const subjectOfferings = (ctrl.offeringsBySubject.get(s.id) || []).filter(o => o.qualificationId === ctrl.studyMode)
    const chosenOid = ctrl.chosenOffering.get(s.id)
    const chosenOff = chosenOid ? subjectOfferings.find(o => o.id === chosenOid) : undefined
    const singleOfferingLabel = subjectOfferings.length === 1 ? subjectOfferings[0].label : null
    const showDelete = isCustom && (ctrl.isEdit || !isSelected)

    // Build board display names for config panel
    const boardDisplayNames = new Map<string, string>()
    for (const o of subjectOfferings) {
      boardDisplayNames.set(o.id, ctrl.getBoardDisplayName(o.id))
    }

    return (
      <div
        key={s.id}
        data-subject-id={s.id}
        data-testid={`subject-card-${s.id}`}
        className={`rounded-2xl border border-l-[3px] overflow-hidden transition-all duration-200 ${
          isSelected
            ? 'border-gray-200 shadow-md ring-1 ring-gray-200/60 bg-white'
            : 'border-gray-100 bg-white'
        }`}
        style={{ borderLeftColor: isSelected ? s.color : '#e5e7eb' }}
      >
        {/* Card header */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => ctrl.toggleExpanded(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctrl.toggleExpanded(s.id) } }}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-[15px] font-semibold truncate ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
              {s.name}
            </span>
            {singleOfferingLabel && (
              <span className="text-gray-400 text-xs ml-1.5 shrink-0">{singleOfferingLabel}</span>
            )}
          </div>
          <StatusBadge
            isSelected={isSelected}
            chosenLabel={chosenOff?.label ?? null}
          />
          {showDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); ctrl.handleDeleteCustom(s.id) }}
              className="shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              aria-label={`Delete ${s.name}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Expanded content */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="mx-3 mb-3 mt-1 px-4 pb-5 pt-1 rounded-xl bg-gray-50/70 border border-gray-100">
              {/* Take this subject? */}
              <div className="pt-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Take this subject?</p>
                <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                  <button
                    onClick={() => ctrl.setSelected(s.id, false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      !isSelected
                        ? 'bg-white text-gray-700 shadow-sm'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Not taking
                  </button>
                  <button
                    onClick={() => ctrl.setSelected(s.id, true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Yes, I take this
                  </button>
                </div>
              </div>

              {isSelected && (
                <SubjectConfigPanel
                  subject={s}
                  subjectOfferings={subjectOfferings}
                  boardDisplayNames={boardDisplayNames}
                  chosenOfferingId={chosenOid ?? null}
                  onSelectOffering={(oid) => ctrl.selectOffering(s.id, oid)}
                  paperList={chosenOid ? (ctrl.papersByOffering.get(chosenOid) || []) : []}
                  confidence={chosenOid ? ctrl.confidences.get(chosenOid) : undefined}
                  onSetConfidence={(level) => {
                    if (chosenOid) ctrl.setConfidence(chosenOid, level)
                  }}
                  onRemove={() => ctrl.handleDeleteCustom(s.id)}
                  showRemoveAction={false}
                  offeringMeta={ctrl.offeringMeta}
                  onAddBoard={() => ctrl.openAddBoard(s.id)}
                  onEditBoard={(oid) => ctrl.openEditBoard(oid)}
                  onRemoveOffering={(oid) => ctrl.handleRemoveOffering(oid)}
                  pendingTierConfirmation={ctrl.pendingTierConfirmations.has(s.id)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasResults = ctrl.filteredSubjects.length > 0
  const { authoritative: authoritativeMatches, suggestions: fuzzyMatches } = ctrl.searchNormalizedMatches
  const showCreateAction = !hasResults && ctrl.searchQuery.trim().length >= 3 && authoritativeMatches.length === 0

  return (
    <div className="flex flex-col md:flex-row md:gap-6 max-w-4xl mx-auto">
      {/* Left pane: browse/config */}
      <div className="flex-1 min-w-0 px-4 pt-12 pb-10">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-gray-700 text-sm font-semibold tracking-tight pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-150 mb-6"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </span>
            {backLabel}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {ctrl.isEdit ? 'Update your exam setup' : 'Build your exam setup'}
          </h1>
          {ctrl.studyMode && <QualificationChip mode={ctrl.studyMode} />}
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-2">
          Pick the subjects you take, choose the right exam option, and rate your confidence.
        </p>
        {ctrl.isEdit && (
          <p className="text-xs text-gray-400 mb-6">
            Changing your setup won't erase past study history.
          </p>
        )}
        {!ctrl.isEdit && <div className="mb-6" />}

        {/* Search */}
        <div className="mb-4">
          <SearchBar
            query={ctrl.searchQuery}
            onChange={ctrl.setSearchQuery}
            onAddOwn={() => ctrl.openWizard()}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Unified subject list */}
          {ctrl.filteredSubjects.map(s => renderSubjectCard(s))}

          {/* A-Level empty state */}
          {ctrl.studyMode === 'alevel' && ctrl.seededSubjects.length === 0 && ctrl.customSubjects.length === 0 && !ctrl.searchQuery.trim() && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
              <p className="text-sm font-medium text-gray-600">We don't have built-in A-Level subjects yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add your own below to get started.</p>
            </div>
          )}

          {/* Search empty state */}
          {!hasResults && ctrl.searchQuery.trim() && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
              {authoritativeMatches.length > 0 ? (
                <>
                  <p className="text-sm text-gray-500 mb-2">This subject already exists</p>
                  {authoritativeMatches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => ctrl.openAddBoard(m.id)}
                      className="block mx-auto mt-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Add option to {m.name}
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
                          Add option to {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {fuzzyMatches.length === 0 && (
                    <p className="text-sm text-gray-500">No subjects match &ldquo;{ctrl.searchQuery.trim()}&rdquo;</p>
                  )}
                  {showCreateAction && (
                    <button
                      onClick={() => ctrl.openWizard(ctrl.searchQuery.trim())}
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
      </div>

      {/* Right pane: sticky summary */}
      <div className="hidden md:block md:w-80 shrink-0 pt-12 pr-4">
        <div className="sticky top-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">Your setup</p>
          <SummaryTray
            subjects={ctrl.subjects}
            selectedSubjectIds={ctrl.selectedSubjectIds}
            chosenOffering={ctrl.chosenOffering}
            offeringsBySubject={ctrl.offeringsBySubject}
            confidences={ctrl.confidences}
            boardMap={ctrl.boardMap}
            nearestExamByOffering={ctrl.nearestExamByOffering}
            canFinish={ctrl.canFinish}
            onFinish={ctrl.handleFinish}
            finishLabel={ctrl.isEdit ? 'Save changes' : 'Start studying'}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}
