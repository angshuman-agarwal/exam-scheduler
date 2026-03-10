import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining } from '../lib/engine'
import type { Board, Offering, Paper, Subject } from '../types'
import QualificationChip from './QualificationChip'
import CustomSubjectWizard from './CustomSubjectWizard'
import type { CustomSubjectDraftData } from './CustomSubjectWizard'

function pastel(hex: string, alpha = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Color palette for draft custom subjects (matches store's CUSTOM_COLORS)
const DRAFT_COLORS = ['#E11D48','#7C3AED','#0891B2','#CA8A04','#059669',
                      '#DC2626','#4F46E5','#0D9488','#C026D3','#EA580C']

interface CustomSubjectDraft {
  key: string
  data: CustomSubjectDraftData
  // Pre-generated synthetic objects for rendering
  subject: Subject
  offering: Offering
  papers: Paper[]
  board: Board | null // null if using an existing board
}

interface OnboardingProps {
  mode?: 'initial' | 'edit'
  onComplete: () => void
  onCancel?: () => void
  onBackToHome?: () => void
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
      <div className="flex justify-between mt-1.5 px-1">
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
      className={`flex-1 min-w-[120px] rounded-xl border-2 p-4 text-left transition-all duration-150 ${
        selected
          ? 'shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]'
      }`}
      style={selected ? {
        borderColor: subjectColor,
        backgroundColor: '#fff',
      } : undefined}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-base font-semibold text-gray-900">{boardName}</span>
        {selected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: subjectColor }}>
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-2">{offering.spec}</p>
      <div className="flex flex-col gap-0.5">
        {firstExamLabel && (
          <p className="text-xs text-gray-400">First exam: {firstExamLabel}</p>
        )}
        <p className="text-xs text-gray-400">{paperCount} {paperCount === 1 ? 'paper' : 'papers'}</p>
      </div>
    </button>
  )
}

function StatusBadge({ isSelected, chosenLabel }: { isSelected: boolean; chosenLabel: string | null }) {
  if (!isSelected) {
    return <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">Not taking</span>
  }
  if (!chosenLabel) {
    return <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Pick board</span>
  }
  return <span className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full font-medium">{chosenLabel}</span>
}

function PaperSchedule({ papers, subjectColor }: { papers: Paper[]; subjectColor: string }) {
  if (papers.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
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

  const todayISO = today.toISOString().slice(0, 10)
  const nearestIdx = sorted.findIndex((p) => p.examDate >= todayISO)
  const nearestDays = nearestIdx >= 0 ? daysRemaining(sorted[nearestIdx].examDate, today) : null
  const nearestPaper = nearestIdx >= 0 ? sorted[nearestIdx] : null

  return (
    <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">
        {sorted.length} {sorted.length === 1 ? 'paper' : 'papers'}
        {nearestDays !== null && nearestPaper && (
          <span className="normal-case tracking-normal font-normal text-gray-400">
            {' \u00B7 '}First exam {fmtDate(nearestPaper.examDate)}{' '}
            {nearestPaper.examTime ? `at ${nearestPaper.examTime}` : '\u00B7 Time TBC'}
          </span>
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        {sorted.map((p, i) => {
          const isNearest = i === nearestIdx
          return (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className={`text-sm shrink-0 ${isNearest ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                {p.name}
              </span>
              <div className="flex items-center gap-2">
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
                <span className={`text-xs tabular-nums ${isNearest ? 'text-gray-500' : 'text-gray-300'}`}>
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
                  {conf !== undefined && (
                    <span className="text-sm leading-none shrink-0">{EMOJIS[Math.max(0, Math.min(4, conf - 1))]}</span>
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

export default function Onboarding({ mode = 'initial', onComplete, onCancel, onBackToHome }: OnboardingProps) {
  const storeSubjects = useAppStore((s) => s.subjects)
  const storeOfferings = useAppStore((s) => s.offerings)
  const storePapers = useAppStore((s) => s.papers)
  const storeBoards = useAppStore((s) => s.boards)
  const topics = useAppStore((s) => s.topics)
  const selectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const updateSelectedOfferings = useAppStore((s) => s.updateSelectedOfferings)
  const persistedStudyMode = useAppStore((s) => s.studyMode)
  const setStudyModeInStore = useAppStore((s) => s.setStudyMode)
  const addCustomSubject = useAppStore((s) => s.addCustomSubject)
  const removeCustomSubject = useAppStore((s) => s.removeCustomSubject)

  const isEdit = mode === 'edit'

  // Local study mode: for initial onboarding, this is uncommitted until handleFinish.
  // For edit mode, it mirrors the persisted value (read-only).
  const [localStudyMode, setLocalStudyMode] = useState<'gcse' | 'alevel' | null>(persistedStudyMode)
  const studyMode = isEdit ? persistedStudyMode : localStudyMode

  const [showWizard, setShowWizard] = useState(false)

  // Custom subject drafts — local-only until handleFinish commits them (initial mode only)
  const [drafts, setDrafts] = useState<CustomSubjectDraft[]>([])

  // Build synthetic objects from drafts for rendering
  const draftSynthetics = useMemo(() => {
    return drafts.map(d => ({
      subject: d.subject,
      offering: d.offering,
      papers: d.papers,
      board: d.board,
    }))
  }, [drafts])

  // Merge store data with draft synthetics
  const subjects = useMemo(() => [
    ...storeSubjects,
    ...draftSynthetics.map(d => d.subject),
  ], [storeSubjects, draftSynthetics])

  const offerings = useMemo(() => [
    ...storeOfferings,
    ...draftSynthetics.map(d => d.offering),
  ], [storeOfferings, draftSynthetics])

  const papers = useMemo(() => [
    ...storePapers,
    ...draftSynthetics.flatMap(d => d.papers),
  ], [storePapers, draftSynthetics])

  const boards = useMemo(() => {
    const merged = [...storeBoards]
    for (const d of draftSynthetics) {
      if (d.board && !merged.some(b => b.id === d.board!.id)) {
        merged.push(d.board)
      }
    }
    return merged
  }, [storeBoards, draftSynthetics])

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(() => {
    if (!isEdit) return new Set()
    const subjectIds = new Set<string>()
    for (const oid of selectedOfferingIds) {
      const off = storeOfferings.find((o) => o.id === oid)
      if (off) subjectIds.add(off.subjectId)
    }
    return subjectIds
  })
  const [chosenOffering, setChosenOffering] = useState<Map<string, string>>(() => {
    if (!isEdit) return new Map()
    const map = new Map<string, string>()
    for (const oid of selectedOfferingIds) {
      const off = storeOfferings.find((o) => o.id === oid)
      if (off) map.set(off.subjectId, oid)
    }
    return map
  })
  const [confidences, setConfidences] = useState<Map<string, number>>(() => {
    if (!isEdit) return new Map()
    const map = new Map<string, number>()
    for (const oid of selectedOfferingIds) {
      const offeringTopics = topics.filter((t) => t.offeringId === oid)
      if (offeringTopics.length > 0) {
        const avg = Math.round(offeringTopics.reduce((sum, t) => sum + t.confidence, 0) / offeringTopics.length)
        map.set(oid, Math.max(1, Math.min(5, avg)))
      }
    }
    return map
  })
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

  // Filter offerings by qualification
  const visibleOfferings = useMemo(
    () => offerings.filter(o => o.qualificationId === studyMode),
    [offerings, studyMode],
  )
  const visibleSubjectIds = useMemo(
    () => new Set(visibleOfferings.map(o => o.subjectId)),
    [visibleOfferings],
  )

  // Partition into seeded and custom
  const seededSubjects = useMemo(
    () => subjects.filter(s => !s.id.startsWith('custom-subject-') && !s.id.startsWith('draft-') && visibleSubjectIds.has(s.id)),
    [subjects, visibleSubjectIds],
  )
  const customSubjects = useMemo(
    () => subjects.filter(s => (s.id.startsWith('custom-subject-') || s.id.startsWith('draft-')) && visibleSubjectIds.has(s.id)),
    [subjects, visibleSubjectIds],
  )

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
    const oldOid = chosenOffering.get(subjectId)
    if (oldOid && oldOid !== offeringId) {
      setConfidences((prev) => { const n = new Map(prev); n.delete(oldOid); return n })
    }
    setChosenOffering((m) => new Map(m).set(subjectId, offeringId))
  }

  const setConfidence = (offeringId: string, level: number) => {
    setConfidences((prev) => new Map(prev).set(offeringId, level))
  }

  const handleDeleteCustom = (subjectId: string) => {
    if (!window.confirm('Remove this custom subject and all its data?')) return
    // Clean local state maps
    const offeringIds = (offeringsBySubject.get(subjectId) ?? []).map(o => o.id)
    setSelectedSubjectIds(prev => { const next = new Set(prev); next.delete(subjectId); return next })
    setChosenOffering(prev => { const next = new Map(prev); next.delete(subjectId); return next })
    setConfidences(prev => { const next = new Map(prev); offeringIds.forEach(id => next.delete(id)); return next })
    setExpandedCards(prev => { const next = new Set(prev); next.delete(subjectId); return next })
    if (subjectId.startsWith('draft-')) {
      setDrafts(prev => prev.filter(d => d.subject.id !== subjectId))
    } else {
      removeCustomSubject(subjectId)
    }
  }

  const canFinish = selectedSubjectIds.size > 0 &&
    [...selectedSubjectIds].every((sid) => chosenOffering.has(sid))

  const handleFinish = () => {
    // Commit any draft custom subjects to the store, mapping draft IDs → real IDs
    const draftIdMap = new Map<string, { subjectId: string; offeringId: string }>()
    for (const draft of drafts) {
      if (!selectedSubjectIds.has(draft.subject.id)) continue
      const result = addCustomSubject({
        ...draft.data,
        qualificationId: localStudyMode!,
      })
      draftIdMap.set(draft.subject.id, result)
    }

    // Build final offering IDs, resolving draft IDs to real store IDs
    const offeringIds = [...selectedSubjectIds]
      .map((sid) => {
        const mapped = draftIdMap.get(sid)
        if (mapped) return mapped.offeringId
        return chosenOffering.get(sid)
      })
      .filter((id): id is string => id !== undefined)

    const finalConf = new Map<string, number>()
    for (const oid of offeringIds) {
      // Confidence may be keyed by draft offering ID — resolve it
      const draftEntry = drafts.find(d => draftIdMap.get(d.subject.id)?.offeringId === oid)
      if (draftEntry) {
        finalConf.set(oid, confidences.get(draftEntry.offering.id) ?? draftEntry.data.confidence)
      } else {
        finalConf.set(oid, confidences.get(oid) ?? 3)
      }
    }
    if (isEdit) {
      updateSelectedOfferings(offeringIds, finalConf)
    } else {
      if (localStudyMode) setStudyModeInStore(localStudyMode)
      completeOnboarding(offeringIds, finalConf)
    }
    onComplete()
  }

  // Render subject card
  const renderSubjectCard = (s: Subject, isCustom: boolean) => {
    const isSelected = selectedSubjectIds.has(s.id)
    const isExpanded = expandedCards.has(s.id)
    const subjectOfferings = (offeringsBySubject.get(s.id) || []).filter(o => o.qualificationId === studyMode)
    const hasMultipleOfferings = subjectOfferings.length > 1
    const chosenOid = chosenOffering.get(s.id)
    const chosenOff = chosenOid ? subjectOfferings.find((o) => o.id === chosenOid) : undefined
    const conf = chosenOid ? (confidences.get(chosenOid) ?? 3) : 3

    // Single-offering header label
    const singleOfferingLabel = subjectOfferings.length === 1 ? subjectOfferings[0].label : null

    // Show delete button?
    const showDelete = isCustom && (isEdit || !isSelected)

    return (
      <div
        key={s.id}
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
          onClick={() => toggleExpanded(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(s.id) } }}
          className="w-full flex items-center gap-3.5 px-5 py-4 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-[15px] font-semibold truncate ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
              {s.name}
            </span>
            {singleOfferingLabel && (
              <span className="text-gray-400 text-xs ml-1.5 shrink-0">{singleOfferingLabel}</span>
            )}
            {isCustom && (
              <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0">Custom</span>
            )}
          </div>
          <StatusBadge
            isSelected={isSelected}
            chosenLabel={chosenOff?.label ?? null}
          />
          {showDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCustom(s.id) }}
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
                    onClick={() => setSelected(s.id, false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      !isSelected
                        ? 'bg-white text-gray-700 shadow-sm'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Not taking
                  </button>
                  <button
                    onClick={() => setSelected(s.id, true)}
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
                <>
                  {/* Board selection */}
                  {hasMultipleOfferings ? (
                    <div className="pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Choose your board</p>
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
  }

  // Qualification picker (initial mode only, when studyMode is null)
  if (studyMode === null && mode === 'initial') {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-8">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-gray-700 text-sm font-semibold tracking-tight pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-150 mb-6"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </span>
              Back to home
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
            What are you studying?
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-10">
            We'll tailor subjects, boards, and exam dates to this course type.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => { setDrafts([]); setSelectedSubjectIds(new Set()); setChosenOffering(new Map()); setConfidences(new Map()); setExpandedCards(new Set()); setLocalStudyMode('gcse') }}
              className="flex-1 rounded-2xl border-2 border-gray-100 bg-white p-6 text-left transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100 hover:shadow"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">GCSE</h3>
              <p className="text-sm text-gray-500">Typical Year 10-11 subjects and papers</p>
            </button>
            <button
              onClick={() => { setDrafts([]); setSelectedSubjectIds(new Set()); setChosenOffering(new Map()); setConfidences(new Map()); setExpandedCards(new Set()); setLocalStudyMode('alevel') }}
              className="flex-1 rounded-2xl border-2 border-gray-100 bg-white p-6 text-left transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100 hover:shadow"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">A-Level</h3>
              <p className="text-sm text-gray-500">Sixth-form subjects and exam structure</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="flex flex-col sm:flex-row sm:gap-6 max-w-4xl mx-auto">
        {/* Main column */}
        <div className="flex-1 min-w-0 px-4 pt-12 pb-8 sm:pb-10">
          {!isEdit && !persistedStudyMode && (
            <button
              onClick={() => {
                setDrafts([])
                setSelectedSubjectIds(new Set())
                setChosenOffering(new Map())
                setConfidences(new Map())
                setExpandedCards(new Set())
                setLocalStudyMode(null)
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-gray-700 text-sm font-semibold tracking-tight pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-150 mb-6"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </span>
              Change qualification
            </button>
          )}
          {!isEdit && persistedStudyMode && onBackToHome && (
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-gray-700 text-sm font-semibold tracking-tight pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-150 mb-6"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </span>
              Back to home
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {isEdit ? 'Update your exam setup' : 'Build your exam setup'}
            </h1>
            {studyMode && <QualificationChip mode={studyMode} />}
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-2">
            Pick the subjects you take, choose the right board, and rate your confidence.
          </p>
          {isEdit && (
            <p className="text-xs text-gray-400 mb-10">
              Changing your setup won't erase past study history.
            </p>
          )}
          {!isEdit && <div className="mb-10" />}

          <div className="flex flex-col gap-3">
            {/* Seeded subjects */}
            {seededSubjects.map((s) => renderSubjectCard(s, false))}

            {/* A-Level empty state */}
            {studyMode === 'alevel' && seededSubjects.length === 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
                <p className="text-sm font-medium text-gray-600">We don't have built-in A-Level subjects yet.</p>
                <p className="text-xs text-gray-400 mt-1">Add your own below to get started.</p>
              </div>
            )}

            {/* Custom subjects section */}
            {customSubjects.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mt-4 mb-1">
                  Your custom subjects
                </p>
                {customSubjects.map((s) => renderSubjectCard(s, true))}
              </>
            )}

            {/* Custom subject CTA */}
            {studyMode !== null && (
              <button
                onClick={() => setShowWizard(true)}
                className="w-full rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center hover:border-gray-300 transition"
              >
                <p className="text-sm font-semibold text-gray-500">Can't find your subject?</p>
                <p className="text-xs text-gray-400 mt-0.5">Add your own</p>
              </button>
            )}
          </div>

          {/* Mobile-only footer tray */}
          <div className="sm:hidden mt-8">
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
              finishLabel={isEdit ? 'Save changes' : 'Start studying'}
              onCancel={isEdit ? onCancel : undefined}
            />
          </div>
        </div>

        {/* Desktop sticky summary sidebar */}
        <div className="hidden sm:block sm:w-72 shrink-0 pt-12 pr-4">
          <div className="sticky top-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">Your setup</p>
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
              finishLabel={isEdit ? 'Save changes' : 'Start studying'}
              onCancel={isEdit ? onCancel : undefined}
            />
          </div>
        </div>
      </div>

      {/* Wizard overlay */}
      {showWizard && studyMode && (
        <CustomSubjectWizard
          studyMode={studyMode}
          onClose={() => setShowWizard(false)}
          draftMode={!isEdit}
          onDraftCreated={(data) => {
            setShowWizard(false)
            const key = crypto.randomUUID()
            const subjectId = `draft-${key}`
            const offeringId = `draft-offering-${key}`

            // Resolve board
            let boardId = data.boardId as string
            let boardName: string
            let newBoard: Board | null = null
            if (data.boardId !== 'other') {
              const existing = boards.find(b => b.id === data.boardId)
              boardName = existing?.name ?? data.boardId.toUpperCase()
            } else {
              const trimmed = (data.customBoardName ?? '').trim()
              const matched = boards.find(b => b.name.toLowerCase() === trimmed.toLowerCase())
              if (matched) {
                boardId = matched.id
                boardName = matched.name
              } else {
                boardId = `draft-board-${key}`
                boardName = trimmed
                newBoard = { id: boardId, name: boardName }
              }
            }

            const usedColors = new Set(subjects.map(s => s.color))
            const color = DRAFT_COLORS.find(c => !usedColors.has(c)) ?? DRAFT_COLORS[0]

            const specLabel = data.spec?.trim() ?? ''
            const draft: CustomSubjectDraft = {
              key,
              data,
              subject: { id: subjectId, name: data.subjectName, color },
              offering: {
                id: offeringId,
                subjectId,
                boardId,
                spec: specLabel,
                label: `${boardName} ${specLabel}`.trim(),
                qualificationId: studyMode!,
              },
              papers: data.papers.map((p, i) => ({
                id: `draft-paper-${key}-${i}`,
                offeringId,
                name: p.name,
                examDate: p.examDate,
                ...(p.examTime ? { examTime: p.examTime } : {}),
              })),
              board: newBoard,
            }

            setDrafts(prev => [...prev, draft])
            setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
            setChosenOffering(prev => new Map(prev).set(subjectId, offeringId))
            setConfidences(prev => new Map(prev).set(offeringId, data.confidence))
            setExpandedCards(prev => new Set(prev).add(subjectId))
          }}
          onCreated={({ subjectId, offeringId, confidence }) => {
            // Edit mode: persisted immediately by wizard
            setShowWizard(false)
            setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
            setChosenOffering(prev => new Map(prev).set(subjectId, offeringId))
            setConfidences(prev => new Map(prev).set(offeringId, confidence))
            setExpandedCards(prev => new Set(prev).add(subjectId))
          }}
        />
      )}
    </div>
  )
}
