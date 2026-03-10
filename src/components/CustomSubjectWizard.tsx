import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { findTemplate, normalizeSubject } from '../data/templates'

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

export interface CustomSubjectDraftData {
  subjectName: string
  boardId: 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec' | 'other'
  customBoardName?: string
  spec?: string
  papers: { name: string; examDate: string; examTime?: string }[]
  topicNames: string[]
  confidence: number
}

interface WizardProps {
  onClose: () => void
  onCreated: (result: { subjectId: string; offeringId: string; confidence: number }) => void
  /** When true, return draft data without persisting to store */
  draftMode?: boolean
  onDraftCreated?: (data: CustomSubjectDraftData) => void
  studyMode: 'gcse' | 'alevel'
  /** Pre-fill subject name (e.g. from search query) */
  initialSubjectName?: string
}

type PaperMode = 'one' | 'multiple' | 'coursework'

interface PaperEntry {
  key: string
  name: string
  examDate: string
  examTime: string
  suggested?: boolean
}

export default function CustomSubjectWizard({ onClose, onCreated, draftMode, onDraftCreated, studyMode, initialSubjectName = '' }: WizardProps) {
  const boards = useAppStore(s => s.boards)
  const subjects = useAppStore(s => s.subjects)
  const offerings = useAppStore(s => s.offerings)
  const addCustomSubject = useAppStore(s => s.addCustomSubject)

  const [step, setStep] = useState(1)

  // Step 1 state
  const [subjectName, setSubjectName] = useState(initialSubjectName)
  const [boardId, setBoardId] = useState<BoardId | null>(null)
  const [customBoardName, setCustomBoardName] = useState('')
  const [spec, setSpec] = useState('')

  // Step 2 state
  const [paperMode, setPaperMode] = useState<PaperMode>('one')
  const [paperEntries, setPaperEntries] = useState<PaperEntry[]>([])
  const [templateFound, setTemplateFound] = useState(false)

  // Step 3 state
  const [topicText, setTopicText] = useState('')
  const [confidence, setConfidence] = useState(3)

  // Board normalization: resolve "other" to known board if name matches
  const resolvedBoard = useMemo(() => {
    if (boardId !== 'other') return { id: boardId, customName: undefined }
    const trimmed = customBoardName.trim()
    if (!trimmed) return { id: 'other' as const, customName: undefined }
    const match = boards.find(b => b.name.toLowerCase() === trimmed.toLowerCase())
    if (match) return { id: match.id as BoardId, customName: undefined }
    return { id: 'other' as const, customName: trimmed }
  }, [boardId, customBoardName, boards])

  // Duplicate warning
  const duplicateWarning = useMemo(() => {
    const trimmed = subjectName.trim()
    if (!trimmed || !boardId) return null
    const normalizedInput = normalizeSubject(trimmed)

    for (const s of subjects) {
      if (normalizeSubject(s.name) !== normalizedInput) continue
      const subjectOfferings = offerings.filter(
        o => o.subjectId === s.id && o.qualificationId === studyMode
      )
      if (subjectOfferings.length === 0) continue

      // Check if same board
      const effectiveBoardId = resolvedBoard.id === 'other' ? null : resolvedBoard.id
      if (effectiveBoardId && subjectOfferings.some(o => o.boardId === effectiveBoardId)) {
        const boardLabel = boards.find(b => b.id === effectiveBoardId)?.name ?? effectiveBoardId
        return `You already have ${s.name} with ${boardLabel}. Adding a duplicate may cause confusion.`
      }
      // Different board but same subject — softer warning
      return `You already have ${s.name} under a different board. This will create a second copy of the subject.`
    }
    return null
  }, [subjectName, boardId, resolvedBoard, subjects, offerings, boards, studyMode])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const canProceedStep1 = subjectName.trim() !== '' &&
    boardId !== null &&
    (boardId !== 'other' || customBoardName.trim() !== '')

  const handleStep1Next = () => {
    // Try template lookup
    const effectiveId = resolvedBoard.id
    if (effectiveId !== 'other') {
      const presetId = effectiveId as 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'
      const template = findTemplate(studyMode, subjectName.trim(), presetId)
      if (template) {
        setTemplateFound(true)
        if (template.papers && template.papers.length > 0) {
          setPaperEntries(template.papers.map((p, i) => ({
            key: `tp-${i}`,
            name: p.name,
            examDate: p.examDate ?? '',
            examTime: p.examTime ?? '',
            suggested: true,
          })))
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

  const handlePaperModeChange = (mode: PaperMode) => {
    setPaperMode(mode)
    if (mode === 'one') {
      setPaperEntries([{ key: 'p-0', name: 'Paper 1', examDate: '', examTime: '' }])
    } else if (mode === 'multiple') {
      setPaperEntries([{ key: 'p-0', name: 'Paper 1', examDate: '', examTime: '' }])
    } else {
      setPaperEntries([{ key: 'p-0', name: 'Main assessment', examDate: '', examTime: '' }])
    }
  }

  const addPaper = () => {
    setPaperEntries(prev => [
      ...prev,
      { key: `p-${Date.now()}`, name: `Paper ${prev.length + 1}`, examDate: '', examTime: '' },
    ])
  }

  const removePaper = (key: string) => {
    setPaperEntries(prev => prev.filter(p => p.key !== key))
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
    const effectiveId = resolvedBoard.id
    const formData: CustomSubjectDraftData = {
      subjectName: subjectName.trim(),
      boardId: effectiveId === 'other' ? 'other' : effectiveId as 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec',
      customBoardName: resolvedBoard.customName,
      spec: spec.trim() || undefined,
      papers: paperEntries.map(p => ({
        name: p.name.trim(),
        examDate: p.examDate,
        ...(p.examTime ? { examTime: p.examTime } : {}),
      })),
      topicNames: parsedTopics,
      confidence,
    }
    if (draftMode && onDraftCreated) {
      onDraftCreated(formData)
    } else {
      const result = addCustomSubject({ ...formData, qualificationId: studyMode })
      onCreated({ ...result, confidence })
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
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Add a custom subject</h2>
            <p className="text-sm text-gray-400 mb-8">
              You're adding this in {studyMode === 'gcse' ? 'GCSE' : 'A-Level'} mode
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2 block">
                Subject name
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                onBlur={() => setSubjectName(prev => prev.trim())}
                placeholder="e.g. History, Psychology"
                className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500 placeholder-gray-300"
              />
            </div>

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

            {duplicateWarning && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
                <p className="text-sm text-amber-700">{duplicateWarning}</p>
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
            {templateFound && paperEntries.some(p => p.suggested) ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  We found the usual paper structure for {subjectName.trim()}
                </h2>
                <p className="text-sm text-gray-400 mb-8">Check the details and fill anything missing.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Papers & dates</h2>
                <p className="text-sm text-gray-400 mb-6">How is this subject examined?</p>

                <div className="flex gap-2 mb-6">
                  {([
                    { id: 'one', label: 'One paper' },
                    { id: 'multiple', label: 'Multiple papers' },
                    { id: 'coursework', label: 'Coursework / mixed' },
                  ] as const).map(m => (
                    <button
                      key={m.id}
                      onClick={() => handlePaperModeChange(m.id)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        paperMode === m.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-col gap-3 mb-4">
              {paperEntries.map((p, i) => (
                <div key={p.key} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {paperMode === 'coursework' ? 'Assessment' : `Paper ${i + 1}`}
                      </span>
                      {p.suggested && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Suggested</span>
                      )}
                    </div>
                    {paperEntries.length > 1 && (
                      <button onClick={() => removePaper(p.key)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
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
                        {paperMode === 'coursework' ? 'Deadline' : 'Exam date'}{!p.examDate && ' *'}
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

            {(paperMode === 'multiple' || (templateFound && paperEntries.some(p => p.suggested))) && (
              <button
                onClick={addPaper}
                className="w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm text-gray-400 font-medium hover:border-gray-300 transition mb-4"
              >
                + Add paper
              </button>
            )}

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
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Starter topics</h2>
            <p className="text-sm text-gray-400 mb-6">Start with 5-10 topics. You can add more later.</p>

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

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create subject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
