import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining } from '../lib/engine'
import type { Offering, Paper, Subject } from '../types'

function pastel(hex: string, alpha = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface OnboardingProps {
  onComplete: () => void
}

const EMOJIS = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60E}'] as const

function ConfidenceRow({
  subjectName,
  offeringId,
  confidence,
  onSet,
}: {
  subjectName: string
  offeringId: string
  confidence: number
  onSet: (offeringId: string, level: number) => void
}) {
  return (
    <div className="pt-3">
      <p className="text-sm text-gray-600 mb-2">
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
                  ? 'scale-125 drop-shadow-sm'
                  : 'opacity-40 hover:opacity-70 hover:scale-110'
              }`}
              aria-label={`Set confidence to ${level}`}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[10px] text-gray-400">Need lots of work</span>
        <span className="text-[10px] text-gray-400">Feeling strong</span>
      </div>
    </div>
  )
}

function BoardTile({
  offering,
  boardName,
  paperCount,
  firstExamLabel,
  selected,
  subjectColor,
  onSelect,
}: {
  offering: Offering
  boardName: string
  paperCount: number
  firstExamLabel: string | null
  selected: boolean
  subjectColor: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 min-w-[120px] rounded-xl border-2 p-3 text-left transition-all duration-150 ${
        selected
          ? 'shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]'
      }`}
      style={selected ? {
        borderColor: subjectColor,
        backgroundColor: pastel(subjectColor, 0.06),
      } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-gray-900">{boardName}</span>
        {selected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: subjectColor }}>
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-gray-500">{offering.spec}</p>
      {firstExamLabel && (
        <p className="text-xs text-gray-400 mt-1">First exam: {firstExamLabel}</p>
      )}
      <p className="text-xs text-gray-400">{paperCount} {paperCount === 1 ? 'paper' : 'papers'}</p>
    </button>
  )
}

function StatusBadge({ isSelected, chosenLabel }: { isSelected: boolean; chosenLabel: string | null }) {
  if (!isSelected) {
    return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not taking</span>
  }
  if (!chosenLabel) {
    return <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Board not chosen</span>
  }
  return <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{chosenLabel}</span>
}

function PaperSchedule({ papers, subjectColor }: { papers: Paper[]; subjectColor: string }) {
  if (papers.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
        <p className="text-xs text-gray-400">Exam schedule not added yet</p>
      </div>
    )
  }

  const today = new Date()
  const sorted = [...papers].sort((a, b) =>
    a.examDate !== b.examDate
      ? a.examDate.localeCompare(b.examDate)
      : (a.examTime ?? '').localeCompare(b.examTime ?? '')
  )
  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const fmtTime = (t?: string) => t ?? 'Time TBC'

  // Find the nearest upcoming paper (not in the past)
  const todayISO = today.toISOString().slice(0, 10)
  const nearestIdx = sorted.findIndex((p) => p.examDate >= todayISO)
  const nearestDays = nearestIdx >= 0 ? daysRemaining(sorted[nearestIdx].examDate, today) : null
  const nearestPaper = nearestIdx >= 0 ? sorted[nearestIdx] : null

  return (
    <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
      <p className="text-xs text-gray-500 mb-2">
        {sorted.length} {sorted.length === 1 ? 'paper' : 'papers'}
        {nearestDays !== null && nearestPaper && (
          <span>
            {' '}&middot; First exam {fmtDate(nearestPaper.examDate)}{' '}
            {nearestPaper.examTime ? `at ${nearestPaper.examTime}` : <>&middot; Time TBC</>}
          </span>
        )}
      </p>
      <div className="flex flex-col gap-1">
        {sorted.map((p, i) => {
          const isNearest = i === nearestIdx
          return (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className={`text-xs shrink-0 ${isNearest ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                {p.name}
              </span>
              <div className="flex items-center gap-1.5">
                {isNearest && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: subjectColor, backgroundColor: pastel(subjectColor, 0.12) }}
                  >
                    Next
                  </span>
                )}
                <span className={`text-xs tabular-nums ${isNearest ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {fmtDate(p.examDate)}
                </span>
                <span className={`text-xs tabular-nums ${isNearest ? 'text-gray-600' : 'text-gray-300'}`}>
                  {fmtTime(p.examTime)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryTray({
  subjects,
  selectedSubjectIds,
  chosenOffering,
  offeringsBySubject,
  confidences,
  boardMap,
  nearestExamByOffering,
  canFinish,
  onFinish,
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
}) {
  const selectedSubjects = subjects.filter((s) => selectedSubjectIds.has(s.id))

  // Find nearest exam across all selected offerings
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {selectedSubjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">No subjects selected yet</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-3">
            {selectedSubjects.map((s) => {
              const oid = chosenOffering.get(s.id)
              const subjectOfferings = offeringsBySubject.get(s.id) || []
              const off = oid ? subjectOfferings.find((o) => o.id === oid) : undefined
              const board = off ? boardMap.get(off.boardId) : undefined
              const conf = oid ? confidences.get(oid) : undefined
              return (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rotate-45 rounded-[1px] shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-gray-800 flex-1 truncate">{s.name}</span>
                  {off ? (
                    <span className="text-xs text-gray-500 shrink-0">{board?.name} {off.spec}</span>
                  ) : (
                    <span className="text-xs text-amber-500 shrink-0">Pick board</span>
                  )}
                  {conf !== undefined && (
                    <span className="text-sm leading-none shrink-0">{EMOJIS[Math.max(0, Math.min(4, conf - 1))]}</span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="text-xs text-gray-400 mb-3">
            <span>{selectedSubjects.length} {selectedSubjects.length === 1 ? 'subject' : 'subjects'} selected</span>
            {nearestSubjectName && nearestDays < Infinity && (
              <span> &middot; Nearest exam: {nearestSubjectName} in {nearestDays} {nearestDays === 1 ? 'day' : 'days'}</span>
            )}
          </div>
        </>
      )}
      <button
        onClick={onFinish}
        disabled={!canFinish}
        className="w-full py-3 bg-blue-500 text-white font-medium rounded-xl transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Start studying
      </button>
    </div>
  )
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const subjects = useAppStore((s) => s.subjects)
  const offerings = useAppStore((s) => s.offerings)
  const papers = useAppStore((s) => s.papers)
  const boards = useAppStore((s) => s.boards)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(() => new Set())
  const [chosenOffering, setChosenOffering] = useState<Map<string, string>>(() => new Map())
  const [confidences, setConfidences] = useState<Map<string, number>>(() => new Map())
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set())

  const boardMap = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])

  const offeringsBySubject = useMemo(() => {
    const map = new Map<string, Offering[]>()
    for (const o of offerings) {
      const arr = map.get(o.subjectId) || []
      arr.push(o)
      map.set(o.subjectId, arr)
    }
    return map
  }, [offerings])

  // Paper count and nearest upcoming exam per offering
  const offeringMeta = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const meta = new Map<string, { paperCount: number; nearestDate: string | null; nearestDays: number | null }>()
    for (const p of papers) {
      const prev = meta.get(p.offeringId)
      const isFuture = p.examDate >= todayISO
      const days = isFuture ? daysRemaining(p.examDate, new Date()) : null
      if (!prev) {
        meta.set(p.offeringId, {
          paperCount: 1,
          nearestDate: isFuture ? p.examDate : null,
          nearestDays: days,
        })
      } else {
        prev.paperCount++
        if (isFuture && (prev.nearestDays === null || days! < prev.nearestDays)) {
          prev.nearestDate = p.examDate
          prev.nearestDays = days
        }
      }
    }
    return meta
  }, [papers])

  const papersByOffering = useMemo(() => {
    const map = new Map<string, Paper[]>()
    for (const p of papers) {
      const arr = map.get(p.offeringId) || []
      arr.push(p)
      map.set(p.offeringId, arr)
    }
    return map
  }, [papers])

  const nearestExamByOffering = useMemo(() => {
    const map = new Map<string, { date: string; days: number }>()
    for (const [oid, m] of offeringMeta) {
      if (m.nearestDate && m.nearestDays !== null) {
        map.set(oid, { date: m.nearestDate, days: m.nearestDays })
      }
    }
    return map
  }, [offeringMeta])

  const toggleExpanded = (subjectId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

  const setSelected = (subjectId: string, take: boolean) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev)
      if (take) {
        next.add(subjectId)
        const subjectOfferings = offeringsBySubject.get(subjectId) || []
        if (subjectOfferings.length === 1) {
          setChosenOffering((m) => new Map(m).set(subjectId, subjectOfferings[0].id))
        }
      } else {
        next.delete(subjectId)
        setChosenOffering((m) => { const n = new Map(m); n.delete(subjectId); return n })
        // Clear confidence for all offerings of this subject
        const subjectOfferings = offeringsBySubject.get(subjectId) || []
        setConfidences((prev) => {
          const n = new Map(prev)
          for (const o of subjectOfferings) n.delete(o.id)
          return n
        })
      }
      return next
    })
  }

  const selectOffering = (subjectId: string, offeringId: string) => {
    // Clear old confidence if switching
    const oldOid = chosenOffering.get(subjectId)
    if (oldOid && oldOid !== offeringId) {
      setConfidences((prev) => { const n = new Map(prev); n.delete(oldOid); return n })
    }
    setChosenOffering((m) => new Map(m).set(subjectId, offeringId))
  }

  const setConfidence = (offeringId: string, level: number) => {
    setConfidences((prev) => new Map(prev).set(offeringId, level))
  }

  const canFinish = selectedSubjectIds.size > 0 &&
    [...selectedSubjectIds].every((sid) => chosenOffering.has(sid))

  const handleFinish = () => {
    const offeringIds = [...selectedSubjectIds]
      .map((sid) => chosenOffering.get(sid))
      .filter((id): id is string => id !== undefined)

    const finalConf = new Map<string, number>()
    for (const oid of offeringIds) {
      finalConf.set(oid, confidences.get(oid) ?? 3)
    }
    completeOnboarding(offeringIds, finalConf)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:gap-6 max-w-4xl mx-auto">
        {/* Main column */}
        <div className="flex-1 min-w-0 px-4 pt-10 pb-8 sm:pb-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Build your exam setup</h1>
          <p className="text-sm text-gray-500 mb-6">
            Pick the subjects you take, choose the right board, and rate your confidence.
          </p>

          <div className="flex flex-col gap-3">
            {subjects.map((s) => {
              const isSelected = selectedSubjectIds.has(s.id)
              const isExpanded = expandedCards.has(s.id)
              const subjectOfferings = offeringsBySubject.get(s.id) || []
              const hasMultipleOfferings = subjectOfferings.length > 1
              const chosenOid = chosenOffering.get(s.id)
              const chosenOff = chosenOid ? subjectOfferings.find((o) => o.id === chosenOid) : undefined
              const conf = chosenOid ? (confidences.get(chosenOid) ?? 3) : 3

              return (
                <div
                  key={s.id}
                  className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'border-gray-200 shadow-sm'
                      : 'border-gray-100 bg-white'
                  }`}
                  style={isSelected ? { backgroundColor: pastel(s.color, 0.04) } : undefined}
                >
                  {/* Color accent bar */}
                  <div
                    className="h-1 transition-all duration-200"
                    style={{ backgroundColor: isSelected ? s.color : pastel(s.color, 0.3) }}
                  />

                  {/* Card header — always visible */}
                  <button
                    onClick={() => toggleExpanded(s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div
                      className="w-2.5 h-2.5 rotate-45 rounded-[1px] shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className={`text-sm font-semibold flex-1 truncate ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                      {s.name}
                    </span>
                    <StatusBadge
                      isSelected={isSelected}
                      chosenLabel={chosenOff?.label ?? null}
                    />
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded content */}
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                    style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-gray-100">
                        {/* Take this subject? */}
                        <div className="pt-3 pb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Take this subject?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelected(s.id, false)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                !isSelected
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              Not taking
                            </button>
                            <button
                              onClick={() => setSelected(s.id, true)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'text-white'
                                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
                              }`}
                              style={isSelected ? { backgroundColor: s.color } : undefined}
                            >
                              Yes, I take this
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <>
                            {/* Board selection */}
                            {hasMultipleOfferings ? (
                              <div className="pt-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Choose your board</p>
                                <div className="flex gap-3">
                                  {subjectOfferings.map((o) => {
                                    const board = boardMap.get(o.boardId)
                                    const meta = offeringMeta.get(o.id)
                                    const examInfo = meta?.nearestDate
                                      ? new Date(meta.nearestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                      : null
                                    return (
                                      <BoardTile
                                        key={o.id}
                                        offering={o}
                                        boardName={board?.name ?? o.boardId}
                                        paperCount={meta?.paperCount ?? 0}
                                        firstExamLabel={examInfo}
                                        selected={chosenOid === o.id}
                                        subjectColor={s.color}
                                        onSelect={() => selectOffering(s.id, o.id)}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                            ) : chosenOff ? (
                              <div className="pt-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Board</p>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100">
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

                            {/* Paper schedule preview */}
                            {chosenOid && (
                              <PaperSchedule
                                papers={papersByOffering.get(chosenOid) || []}
                                subjectColor={s.color}
                              />
                            )}

                            {/* Confidence */}
                            {chosenOid && (
                              <ConfidenceRow
                                subjectName={s.name}
                                offeringId={chosenOid}
                                confidence={conf}
                                onSet={setConfidence}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile-only footer tray */}
          <div className="sm:hidden mt-6">
            <SummaryTray
              subjects={subjects}
              selectedSubjectIds={selectedSubjectIds}
              chosenOffering={chosenOffering}
              offeringsBySubject={offeringsBySubject}
              confidences={confidences}
              boardMap={boardMap}
              nearestExamByOffering={nearestExamByOffering}
              canFinish={canFinish}
              onFinish={handleFinish}
            />
          </div>
        </div>

        {/* Desktop sticky summary sidebar */}
        <div className="hidden sm:block sm:w-72 shrink-0 pt-10 pr-4">
          <div className="sticky top-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your setup</p>
            <SummaryTray
              subjects={subjects}
              selectedSubjectIds={selectedSubjectIds}
              chosenOffering={chosenOffering}
              offeringsBySubject={offeringsBySubject}
              confidences={confidences}
              boardMap={boardMap}
              nearestExamByOffering={nearestExamByOffering}
              canFinish={canFinish}
              onFinish={handleFinish}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
