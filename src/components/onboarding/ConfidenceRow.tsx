const EMOJIS = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60E}'] as const

export default function ConfidenceRow({
  subjectName,
  offeringId,
  confidence,
  onSet,
}: {
  subjectName: string
  offeringId: string
  confidence: number | undefined
  onSet: (offeringId: string, level: number) => void
}) {
  return (
    <div className="pt-4 mt-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Confidence</p>
      <p className="text-sm text-gray-600 mb-3">
        How confident do you feel in {subjectName}?
      </p>
      <div className="flex justify-between items-end">
        {EMOJIS.map((emoji, i) => {
          const level = i + 1
          const selected = level === confidence
          return (
            <button
              key={level}
              onClick={() => onSet(offeringId, level)}
              className={`text-2xl leading-none p-1.5 rounded-lg transition-all duration-150 ${
                selected
                  ? 'scale-130 bg-gray-100 rounded-xl shadow-md ring-2 ring-gray-200'
                  : 'opacity-80 hover:opacity-100 hover:scale-110'
              }`}
              aria-label={`Set confidence to ${level}`}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5 px-1">
        <span className="text-[10px] text-gray-400">Need lots of work</span>
        <span className="text-[10px] text-gray-400">Feeling strong</span>
      </div>
    </div>
  )
}

export { EMOJIS }
