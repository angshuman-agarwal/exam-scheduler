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
}: SubjectConfigPanelProps) {
  const hasMultipleOfferings = subjectOfferings.length > 1
  const chosenOff = chosenOfferingId ? subjectOfferings.find(o => o.id === chosenOfferingId) : undefined

  return (
    <div className="flex flex-col gap-1">
      {/* Board selection */}
      {hasMultipleOfferings ? (
        <div className="pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Choose your board</p>
          <div className="flex gap-3">
            {subjectOfferings.map((o) => {
              const boardName = boardDisplayNames.get(o.id) ?? o.boardId
              const meta = offeringMeta.get(o.id)
              const examInfo = meta?.nearestDate
                ? new Date(meta.nearestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : null
              return (
                <BoardTile
                  key={o.id}
                  offering={o}
                  boardName={boardName}
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
      ) : chosenOff ? (
        <div className="pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Board</p>
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
