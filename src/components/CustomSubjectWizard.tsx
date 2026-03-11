import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { findTemplate, normalizeSpec, findNormalizedMatches } from '../data/templates'
import type { Subject, Offering } from '../types'

const EMOJIS = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60E}'] as const

const PRESET_BOARDS = [
  { id: 'aqa' as const, label: 'AQA' },
  { id: 'ccea' as const, label: 'CCEA' },
  { id: 'eduqas' as const, label: 'Eduqas' },
  { id: 'edexcel' as const, label: 'Edexcel' },
  { id: 'ocr' as const, label: 'OCR' },
  { id: 'wjec' as const, label: 'WJEC' },
]

type BoardId = 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec' | 'other'

export type WizardMode =
  | { kind: 'create-subject'; initialSubjectName?: string }
  | { kind: 'add-offering'; subjectId: string; subjectName: string }
  | { kind: 'edit-offering'; offeringId: string; subjectId: string; subjectName: string;
      prefill: { boardLabel: string;
                 paper: { name: string; examDate: string; examTime?: string };
                 topicNames: string[] } }

export interface CustomSubjectDraftData {
  existingSubjectId?: string
  subjectName: string
  boardId: 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec' | 'other'
  customBoardName?: string
  spec?: string
  paper: { name: string; examDate: string; examTime?: string }
  topicNames: string[]
  confidence?: number
}

interface WizardProps {
  onClose: () => void
  onCreated: (result: { subjectId: string; offeringId: string; confidence?: number }) => void
  /** When true, return draft data without persisting to store */
  draftMode?: boolean
  onDraftCreated?: (data: CustomSubjectDraftData) => void
  studyMode: 'gcse' | 'alevel'
  mode: WizardMode
  /** All subjects (including drafts) for normalized-match checks */
  allSubjects: Subject[]
  /** All offerings (including drafts) for duplicate checks */
  allOfferings: Offering[]
  /** Navigate to an existing offering (add-offering duplicate redirect) */
  onExistingOffering?: (subjectId: string, offeringId: string) => void
}

interface PaperEntry {
  key: string
  name: string
  examDate: string
  examTime: string
  suggested?: boolean
}

export default function CustomSubjectWizard({ onClose, onCreated, draftMode, onDraftCreated, studyMode, mode, allSubjects, allOfferings, onExistingOffering }: WizardProps) {
  const boards = useAppStore(s => s.boards)
  const addCustomSubject = useAppStore(s => s.addCustomSubject)
  const updateOfferingBundle = useAppStore(s => s.updateOfferingBundle)
  const getOfferingCascadeCounts = useAppStore(s => s.getOfferingCascadeCounts)

  const [internalMode, setInternalMode] = useState<WizardMode>(mode)
  const isCreateSubject = internalMode.kind === 'create-subject'
  const isAddOffering = internalMode.kind === 'add-offering'
  const isEditOffering = internalMode.kind === 'edit-offering'
  const initialSubjectName = mode.kind === 'create-subject' ? (mode.initialSubjectName ?? '') : ''

  const [step, setStep] = useState(isEditOffering ? 2 : 1)

  // Step 1 state
  const [subjectName, setSubjectName] = useState(initialSubjectName)
  const [boardId, setBoardId] = useState<BoardId | null>(null)
  const [customBoardName, setCustomBoardName] = useState('')
  const [spec, setSpec] = useState('')

  // Step 2 state
  const [paperEntries, setPaperEntries] = useState<PaperEntry[]>(() =>
    isEditOffering && mode.kind === 'edit-offering'
      ? [{ key: 'p-0', name: mode.prefill.paper.name, examDate: mode.prefill.paper.examDate, examTime: mode.prefill.paper.examTime ?? '' }]
      : [],
  )
  const [templateFound, setTemplateFound] = useState(false)

  // Step 3 state
  const [topicText, setTopicText] = useState(() =>
    isEditOffering && mode.kind === 'edit-offering' ? mode.prefill.topicNames.join('\n') : '',
  )
  const [confidence, setConfidence] = useState(3)

  // Normalized match redirect state (create-subject only)
  const [redirectTarget, setRedirectTarget] = useState<{ id: string; name: string }[] | null>(null)
  const [isFuzzySuggestion, setIsFuzzySuggestion] = useState(false)

  // Board normalization: resolve "other" to known board if name matches
  const resolvedBoard = useMemo(() => {
    if (boardId !== 'other') return { id: boardId, customName: undefined }
    const trimmed = customBoardName.trim()
    if (!trimmed) return { id: 'other' as const, customName: undefined }
    const match = boards.find(b => b.name.toLowerCase() === trimmed.toLowerCase())
    if (match) return { id: match.id as BoardId, customName: undefined }
    return { id: 'other' as const, customName: trimmed }
  }, [boardId, customBoardName, boards])

  // Duplicate offering check (add-offering mode)
  // When spec is provided, require exact board+spec match.
  // When spec is empty, match only if there is exactly one offering on that board
  // for the subject — multiple offerings means the user needs to disambiguate by spec.
  const duplicateOffering = useMemo(() => {
    if (!isAddOffering || !boardId) return null
    if (internalMode.kind !== 'add-offering') return null
    const effectiveBoardId = resolvedBoard.id === 'other' ? null : resolvedBoard.id
    if (!effectiveBoardId) return null
    const normSpec = normalizeSpec(spec)
    const boardMatches = allOfferings.filter(o =>
      o.subjectId === internalMode.subjectId && o.boardId === effectiveBoardId
    )
    if (normSpec === '') {
      return boardMatches.length === 1 ? boardMatches[0] : null
    }
    return boardMatches.find(o => normalizeSpec(o.spec) === normSpec) ?? null
  }, [isAddOffering, internalMode, boardId, resolvedBoard, spec, allOfferings])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const canProceedStep1 = isAddOffering
    ? boardId !== null && (boardId !== 'other' || customBoardName.trim() !== '') && !duplicateOffering
    : subjectName.trim() !== '' && boardId !== null && (boardId !== 'other' || customBoardName.trim() !== '')

  const handleStep1Next = () => {
    // Normalized match check (create-subject only)
    if (isCreateSubject) {
      const { authoritative, suggestions: fuzzy } = findNormalizedMatches(subjectName.trim(), allSubjects, allOfferings, studyMode, 'interactive')

      if (authoritative.length === 1) {
        // Single authoritative match: morph wizard in-place to add-offering mode
        setInternalMode({ kind: 'add-offering', subjectId: authoritative[0].id, subjectName: authoritative[0].name })
        setRedirectTarget(null)
        setIsFuzzySuggestion(false)
        return
      }
      if (authoritative.length > 1) {
        setRedirectTarget(authoritative)
        setIsFuzzySuggestion(false)
        return
      }
      if (fuzzy.length > 0) {
        // Fuzzy matches: show "Did you mean?" suggestion, never auto-redirect
        setRedirectTarget(fuzzy)
        setIsFuzzySuggestion(true)
        return
      }
    }

    // Try template lookup
    const effectiveId = resolvedBoard.id
    if (effectiveId !== 'other') {
      const presetId = effectiveId as 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'
      const nameForTemplate = isCreateSubject ? subjectName.trim() : (internalMode.kind === 'add-offering' ? internalMode.subjectName : '')
      const template = findTemplate(studyMode, nameForTemplate, presetId)
      if (template) {
        setTemplateFound(true)
        if (template.papers && template.papers.length > 0) {
          // Use first paper only for v1 single-paper shape
          const p = template.papers[0]
          setPaperEntries([{
            key: 'tp-0',
            name: p.name,
            examDate: p.examDate ?? '',
            examTime: p.examTime ?? '',
            suggested: true,
          }])
        } else {
          setPaperEntries([{ key: 'p-0', name: 'Paper 1', examDate: '', examTime: '' }])
        }
        if (template.topics && template.topics.length > 0) {
          setTopicText(template.topics.join('\n'))
        }
        setStep(2)
        return
      }
    }
    // No template
    setTemplateFound(false)
    setPaperEntries([{ key: 'p-0', name: 'Paper 1', examDate: '', examTime: '' }])
    setStep(2)
  }

  const updatePaper = (key: string, field: keyof PaperEntry, value: string) => {
    setPaperEntries(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p))
  }

  const canProceedStep2 = paperEntries.length >= 1 &&
    paperEntries.every(p => p.name.trim() !== '' && p.examDate !== '')

  const parsedTopics = useMemo(() => {
    const lines = topicText.split('\n').map(l => l.trim()).filter(Boolean)
    return [...new Set(lines)]
  }, [topicText])

  const hasCommas = topicText.includes(',') && !topicText.includes('\n')

  const splitCommas = () => {
    setTopicText(topicText.split(',').map(s => s.trim()).filter(Boolean).join('\n'))
  }

  const canSubmit = parsedTopics.length >= 1

  const handleSubmit = () => {
    // Edit-offering: destructive confirmation
    if (isEditOffering && mode.kind === 'edit-offering') {
      const counts = getOfferingCascadeCounts(mode.offeringId, parsedTopics)
      if (counts.topicCount > 0) {
        const parts: string[] = []
        if (counts.topicCount > 0) parts.push(`${counts.topicCount} topics`)
        if (counts.sessionCount > 0) parts.push(`${counts.sessionCount} study sessions`)
        if (counts.noteCount > 0) parts.push(`${counts.noteCount} notes`)
        if (counts.planCount > 0) parts.push(`${counts.planCount} plan items`)
        if (!window.confirm(`This will remove ${parts.join(', ')}. Continue?`)) return
      }
      updateOfferingBundle(mode.offeringId, {
        paper: {
          name: paperEntries[0].name.trim(),
          examDate: paperEntries[0].examDate,
          ...(paperEntries[0].examTime ? { examTime: paperEntries[0].examTime } : {}),
        },
        topics: parsedTopics,
      })
      onClose()
      return
    }

    const effectiveId = resolvedBoard.id
    const paper = {
      name: paperEntries[0].name.trim(),
      examDate: paperEntries[0].examDate,
      ...(paperEntries[0].examTime ? { examTime: paperEntries[0].examTime } : {}),
    }
    const formData: CustomSubjectDraftData = {
      existingSubjectId: isAddOffering && internalMode.kind === 'add-offering' ? internalMode.subjectId : undefined,
      subjectName: isAddOffering && internalMode.kind === 'add-offering' ? internalMode.subjectName : subjectName.trim(),
      boardId: effectiveId === 'other' ? 'other' : effectiveId as 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec',
      customBoardName: resolvedBoard.customName,
      spec: spec.trim() || undefined,
      paper,
      topicNames: parsedTopics,
      confidence: isCreateSubject ? confidence : undefined,
    }
    if (draftMode && onDraftCreated) {
      onDraftCreated(formData)
    } else {
      if (formData.existingSubjectId) {
        const result = useAppStore.getState().addOfferingToSubject(formData.existingSubjectId, {
          ...formData,
          qualificationId: studyMode,
        })
        if (result) onCreated({ subjectId: formData.existingSubjectId, offeringId: result.offeringId })
      } else {
        const result = addCustomSubject({ ...formData, confidence: formData.confidence ?? 3, qualificationId: studyMode })
        onCreated({ ...result, confidence: formData.confidence })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#faf9f7] overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="w-8">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full ${s === step ? 'bg-blue-600' : s < step ? 'bg-blue-300' : 'bg-gray-200'}`} />
            ))}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Step 1 of 3</p>
            {isAddOffering && internalMode.kind === 'add-offering' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Add a board to <span className="text-blue-600">{internalMode.subjectName}</span>
                </h2>
                <p className="text-sm text-gray-400 mb-8">Choose the exam board and spec for this offering.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Add a custom subject</h2>
                <p className="text-sm text-gray-400 mb-8">
                  You're adding this in {studyMode === 'gcse' ? 'GCSE' : 'A-Level'} mode
                </p>
              </>
            )}

            {/* Subject picker (create-subject: multiple normalized matches found) */}
            {redirectTarget && redirectTarget.length > 0 && (
              <div className="rounded-xl bg-white border border-gray-100 p-5 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">{isFuzzySuggestion ? 'Did you mean?' : 'Which subject did you mean?'}</p>
                <div className="flex flex-col gap-1.5">
                  {redirectTarget.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setInternalMode({ kind: 'add-offering', subjectId: t.id, subjectName: t.name })
                        setRedirectTarget(null)
                      }}
                      className="flex items-center justify-between w-full text-left px-3.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isAddOffering && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2 block">
                  Subject name
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={e => { setSubjectName(e.target.value); setRedirectTarget(null); setIsFuzzySuggestion(false) }}
                  onBlur={() => setSubjectName(prev => prev.trim())}
                  placeholder="e.g. History, Psychology"
                  className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500 placeholder-gray-300"
                />
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3 block">
                Exam board
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_BOARDS.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBoardId(b.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      boardId === b.id
                        ? 'bg-blue-600 text-white shadow-sm border border-transparent'
                        : 'bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
                <button
                  onClick={() => setBoardId('other')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    boardId === 'other'
                      ? 'bg-gray-700 text-white shadow-sm border border-transparent'
                      : 'bg-gray-50 text-gray-400 border border-gray-100 hover:border-gray-300'
                  }`}
                >
                  Other
                </button>
              </div>

              {boardId === 'other' && (
                <input
                  type="text"
                  value={customBoardName}
                  onChange={e => setCustomBoardName(e.target.value)}
                  placeholder="Board name"
                  className="mt-3 w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2 block">
                Spec code <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={spec}
                onChange={e => setSpec(e.target.value)}
                placeholder="e.g. 8145"
                className="w-full text-sm text-gray-700 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500 placeholder-gray-300"
              />
            </div>

            {duplicateOffering && internalMode.kind === 'add-offering' && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
                <p className="text-sm text-blue-700 mb-2">This board already exists for this subject.</p>
                <button
                  onClick={() => {
                    if (onExistingOffering) {
                      onExistingOffering(internalMode.subjectId, duplicateOffering.id)
                    } else {
                      onClose()
                    }
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Go to existing board
                </button>
              </div>
            )}

            <button
              onClick={handleStep1Next}
              disabled={!canProceedStep1}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Step 2 of 3</p>
            {isEditOffering && mode.kind === 'edit-offering' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Edit <span className="text-blue-600">{mode.prefill.boardLabel}</span> for {mode.subjectName}
                </h2>
                <p className="text-sm text-gray-400 mb-6">Update the assessment date.</p>
              </>
            ) : templateFound && paperEntries.some(p => p.suggested) ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  We found the usual structure for {isAddOffering && internalMode.kind === 'add-offering' ? internalMode.subjectName : subjectName.trim()}
                </h2>
                <p className="text-sm text-gray-400 mb-8">Check the details and fill anything missing.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Assessment date</h2>
                <p className="text-sm text-gray-400 mb-6">When is this assessed?</p>
              </>
            )}

            <div className="flex flex-col gap-3 mb-4">
              {paperEntries.map((p) => (
                <div key={p.key} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">Assessment</span>
                      {p.suggested && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Suggested</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updatePaper(p.key, 'name', e.target.value)}
                    placeholder="Paper name"
                    className="w-full text-sm text-gray-700 border-b border-gray-200 pb-2 mb-3 focus:outline-none focus:border-blue-500 placeholder-gray-300"
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 mb-1 block">
                        Exam date{!p.examDate && ' *'}
                      </label>
                      <input
                        type="date"
                        value={p.examDate}
                        onChange={e => updatePaper(p.key, 'examDate', e.target.value)}
                        className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-[10px] text-gray-400 mb-1 block">Time</label>
                      <input
                        type="time"
                        value={p.examTime}
                        onChange={e => updatePaper(p.key, 'examTime', e.target.value)}
                        className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Step 3 of 3</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {isEditOffering ? 'Edit topics' : 'Starter topics'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {isEditOffering ? 'Update the topic list for this offering.' : 'Start with 5-10 topics. You can add more later.'}
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <textarea
                value={topicText}
                onChange={e => setTopicText(e.target.value)}
                placeholder={"e.g.\nWWI causes\nTreaty of Versailles\nWeimar Republic\nNazi rise to power"}
                rows={8}
                className="w-full text-sm text-gray-700 bg-transparent resize-none focus:outline-none placeholder-gray-300 leading-relaxed"
              />
              {hasCommas && (
                <button
                  onClick={splitCommas}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                >
                  Split commas into lines
                </button>
              )}
              {parsedTopics.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {parsedTopics.length} {parsedTopics.length === 1 ? 'topic' : 'topics'}
                </p>
              )}
            </div>

            {isCreateSubject && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">
                  Starting confidence for all topics
                </p>
                <div className="flex justify-between items-end">
                  {EMOJIS.map((emoji, i) => {
                    const level = i + 1
                    const selected = level === confidence
                    return (
                      <button
                        key={level}
                        onClick={() => setConfidence(level)}
                        className={`text-2xl leading-none p-1.5 rounded-lg transition-all duration-150 ${
                          selected
                            ? 'scale-125 drop-shadow-sm'
                            : 'opacity-40 hover:opacity-70 hover:scale-110'
                        }`}
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
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEditOffering ? 'Save changes' : isAddOffering ? 'Add board' : 'Create subject'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
