import type { Paper, Subject, Offering } from '../../types'
import BoardTile from './BoardTile'
import ConfidenceRow from './ConfidenceRow'
import PaperSchedule from './PaperSchedule'

interface SubjectConfigPanelProps {
  subject: Subject
  subjectOfferings: Offering[]
  boardDisplayNames: Map<string, string>
  chosenOfferingId: string | null
  onSelectOffering: (offeringId: string) => void
  paperList: Paper[]
  confidence: number | undefined
  onSetConfidence: (level: number) => void
  onRemove: () => void
  showRemoveAction: boolean
  offeringMeta: Map<string, { paperCount: number; nearestDate: string | null; nearestDays: number | null }>
  onAddBoard?: () => void
  onEditBoard?: (offeringId: string) => void
  onRemoveOffering?: (offeringId: string) => void
  pendingTierConfirmation?: boolean
}

export default function SubjectConfigPanel({
  subject,
  subjectOfferings,
  boardDisplayNames,
  chosenOfferingId,
  onSelectOffering,
  paperList,
  confidence,
  onSetConfidence,
  onRemove,
  showRemoveAction,
  offeringMeta,
  onAddBoard,
  onEditBoard,
  onRemoveOffering,
  pendingTierConfirmation,
}: SubjectConfigPanelProps) {
  const hasMultipleOfferings = subjectOfferings.length > 1
  const chosenOff = chosenOfferingId ? subjectOfferings.find(o => o.id === chosenOfferingId) : undefined

  return (
    <div className="flex flex-col gap-1">
      {/* Tier confirmation banner for migrated subjects */}
      {pendingTierConfirmation && (
        <div data-testid={`pending-tier-banner-${subject.id}`} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1 mb-1">
          <p className="text-sm text-amber-800">
            We've updated exam options for this subject. Please confirm your tier.
          </p>
        </div>
      )}

      {/* Board selection */}
      {hasMultipleOfferings ? (
        <div className="pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Choose your exam option</p>
          {(() => {
            // Group offerings by boardId for visual grouping
            const groups: Array<{ boardId: string; boardName: string; offerings: Offering[] }> = []
            const seen = new Map<string, number>()
            for (const o of subjectOfferings) {
              const idx = seen.get(o.boardId)
              if (idx !== undefined) {
                groups[idx].offerings.push(o)
              } else {
                const bName = boardDisplayNames.get(o.id) ?? o.boardId
                seen.set(o.boardId, groups.length)
                groups.push({ boardId: o.boardId, boardName: bName, offerings: [o] })
              }
            }
            return groups.map(({ boardId, boardName, offerings: groupOfferings }) => (
              <div key={boardId} className="mb-3">
                {groups.length > 1 && (
                  <p className="text-xs font-medium text-gray-500 mb-1.5">{boardName}</p>
                )}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  {groupOfferings.map((o) => {
                    const primaryLabel = o.label.startsWith(boardName + ' ')
                      ? o.label.slice(boardName.length + 1)
                      : o.label
                    const meta = offeringMeta.get(o.id)
                    const examInfo = meta?.nearestDate
                      ? new Date(meta.nearestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : null
                    return (
                      <BoardTile
                        key={o.id}
                        offering={o}
                        primaryLabel={primaryLabel}
                        paperCount={meta?.paperCount ?? 0}
                        firstExamLabel={examInfo}
                        selected={chosenOfferingId === o.id}
                        subjectColor={subject.color}
                        onSelect={() => onSelectOffering(o.id)}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          })()}
        </div>
      ) : chosenOff ? (
        <div className="pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Exam option</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50/80 border border-gray-100">
            <span className="text-sm font-medium text-gray-700">{chosenOff.label}</span>
            {(() => {
              const meta = offeringMeta.get(chosenOff.id)
              return meta ? (
                <span className="text-xs text-gray-400">{meta.paperCount} {meta.paperCount === 1 ? 'paper' : 'papers'}</span>
              ) : null
            })()}
          </div>
        </div>
      ) : null}

      {/* Offering action row (custom offerings only) */}
      {chosenOfferingId && chosenOff && (onEditBoard || onRemoveOffering) && (
        (() => {
          const isCustomPersisted = chosenOfferingId.startsWith('custom-offering-')
          const isDraft = chosenOfferingId.startsWith('draft-offering-')
          if (!isCustomPersisted && !isDraft) return null
          return (
            <div className="flex items-center gap-3 px-1 pt-1 pb-1">
              {isCustomPersisted && onEditBoard && (
                <button
                  onClick={() => onEditBoard(chosenOfferingId)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
              {(isCustomPersisted || isDraft) && onRemoveOffering && (
                <button
                  onClick={() => onRemoveOffering(chosenOfferingId)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
              {isCustomPersisted && (
                <span className="text-[10px] text-gray-400">Added by you</span>
              )}
            </div>
          )
        })()
      )}

      {/* + Add board */}
      {onAddBoard && (
        <div className="pt-2">
          <button
            onClick={onAddBoard}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 px-1"
          >
            + Add exam option
          </button>
        </div>
      )}

      {/* Paper schedule */}
      {chosenOfferingId && (
        <PaperSchedule papers={paperList} subjectColor={subject.color} />
      )}

      {/* Confidence */}
      {chosenOfferingId && (
        <ConfidenceRow
          subjectName={subject.name}
          offeringId={chosenOfferingId}
          confidence={confidence}
          onSet={(_oid, level) => onSetConfidence(level)}
        />
      )}

      {/* Remove action */}
      {showRemoveAction && (
        <button
          onClick={onRemove}
          className="mt-4 text-sm text-red-500 hover:text-red-600 font-medium text-left px-1"
        >
          Remove subject
        </button>
      )}
    </div>
  )
}
