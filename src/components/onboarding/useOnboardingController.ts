import { useState, useMemo, useRef, useCallback } from 'react'
import { useAppStore, useEffectiveSelectedOfferingIds } from '../../stores/app.store'
import { daysRemaining } from '../../lib/engine'
import { matchSubject, sanitizeSubjectInput } from '../../data/subject-matcher'
import { normalizeSubject, findNormalizedMatches } from '../../data/templates'
import type { Board, Offering, Paper, Subject } from '../../types'
import type { CustomSubjectDraftData, WizardMode } from '../CustomSubjectWizard'

// Color palette for draft custom subjects (matches store's CUSTOM_COLORS)
const DRAFT_COLORS = ['#E11D48','#7C3AED','#0891B2','#CA8A04','#059669',
                      '#DC2626','#4F46E5','#0D9488','#C026D3','#EA580C']

export interface CustomSubjectDraft {
  key: string
  data: CustomSubjectDraftData
  subject: Subject | null
  offering: Offering
  papers: Paper[]
  board: Board | null
}

interface OnboardingControllerProps {
  mode: 'initial' | 'edit'
  onComplete: () => void
  onCancel?: () => void
  onBackToHome?: () => void
}

export type MobileStep = 'pick' | 'configure'

export function useOnboardingController({ mode, onComplete }: OnboardingControllerProps) {
  const storeSubjects = useAppStore((s) => s.subjects)
  const storeOfferings = useAppStore((s) => s.offerings)
  const storePapers = useAppStore((s) => s.papers)
  const storeBoards = useAppStore((s) => s.boards)
  const topics = useAppStore((s) => s.topics)
  const rawSelectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)
  const effectiveOfferingIds = useEffectiveSelectedOfferingIds()
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const updateSelectedOfferings = useAppStore((s) => s.updateSelectedOfferings)
  const pendingTierConfirmations = useAppStore((s) => s.pendingTierConfirmations)
  const confirmTierSelection = useAppStore((s) => s.confirmTierSelection)
  const dismissPendingSubject = useAppStore((s) => s.dismissPendingSubject)
  const persistedStudyMode = useAppStore((s) => s.studyMode)
  const setStudyModeInStore = useAppStore((s) => s.setStudyMode)
  const addCustomSubject = useAppStore((s) => s.addCustomSubject)
  const removeCustomSubject = useAppStore((s) => s.removeCustomSubject)

  const isEdit = mode === 'edit'

  const [localStudyMode, setLocalStudyMode] = useState<'gcse' | 'alevel' | null>(persistedStudyMode)
  const studyMode = isEdit ? persistedStudyMode : localStudyMode

  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null)
  const [drafts, setDrafts] = useState<CustomSubjectDraft[]>([])

  const addOfferingToSubject = useAppStore((s) => s.addOfferingToSubject)
  const removeOfferingFromStore = useAppStore((s) => s.removeOffering)

  // Mobile state
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileStep, setMobileStep] = useState<MobileStep>('pick')
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const scrollPositionRef = useRef(0)

  const draftSynthetics = useMemo(() => {
    return drafts.map(d => ({
      subject: d.subject,
      offering: d.offering,
      papers: d.papers,
      board: d.board,
    }))
  }, [drafts])

  const subjects = useMemo(() => [
    ...storeSubjects,
    ...draftSynthetics.filter(d => d.subject !== null).map(d => d.subject!),
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
    // Use effective IDs so pending-tier subjects are included as "taken"
    const subjectIds = new Set<string>()
    for (const oid of effectiveOfferingIds) {
      const off = storeOfferings.find((o) => o.id === oid)
      if (off) subjectIds.add(off.subjectId)
    }
    return subjectIds
  })

  const [chosenOffering, setChosenOffering] = useState<Map<string, string>>(() => {
    if (!isEdit) return new Map()
    const map = new Map<string, string>()
    // Only preselect from persisted raw IDs — NOT effective IDs
    // Pending-tier subjects must have chosenOffering = null (no tier preselected)
    for (const oid of rawSelectedOfferingIds) {
      const off = storeOfferings.find((o) => o.id === oid)
      if (!off) continue
      // Skip if this subject is pending tier confirmation — neither F nor H should be preselected
      if (pendingTierConfirmations.has(off.subjectId)) continue
      map.set(off.subjectId, oid)
    }
    return map
  })

  const [confidences, setConfidences] = useState<Map<string, number>>(() => {
    if (!isEdit) return new Map()
    const map = new Map<string, number>()
    // Use effective IDs for confidence (so pending subjects get their bootstrapped confidences)
    for (const oid of effectiveOfferingIds) {
      // Skip offerings whose subject is pending (they show as "needs setup")
      const off = storeOfferings.find((o) => o.id === oid)
      if (off && pendingTierConfirmations.has(off.subjectId)) continue
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

  const visibleOfferings = useMemo(
    () => offerings.filter(o => o.qualificationId === studyMode),
    [offerings, studyMode],
  )

  const visibleSubjectIds = useMemo(
    () => new Set(visibleOfferings.map(o => o.subjectId)),
    [visibleOfferings],
  )

  const seededSubjects = useMemo(
    () => subjects.filter(s => !s.id.startsWith('custom-subject-') && !s.id.startsWith('draft-') && visibleSubjectIds.has(s.id)),
    [subjects, visibleSubjectIds],
  )

  const customSubjects = useMemo(
    () => subjects.filter(s => (s.id.startsWith('custom-subject-') || s.id.startsWith('draft-')) && visibleSubjectIds.has(s.id)),
    [subjects, visibleSubjectIds],
  )

  // Search filtering
  const matchesSearch = useCallback((subject: Subject): boolean => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    const subjectKey = normalizeSubject(subject.name)

    // Match subject name (raw)
    if (subject.name.toLowerCase().includes(q)) return true

    // Canonical key match via matcher (handles aliases, fuzzy, ambiguous)
    const queryResult = matchSubject(q, 'interactive')
    if (queryResult.kind === 'exact' || queryResult.kind === 'alias' || queryResult.kind === 'fuzzy') {
      if (queryResult.canonicalKey === subjectKey) return true
    } else if (queryResult.kind === 'ambiguous') {
      if (queryResult.candidates.some(c => c.canonicalKey === subjectKey)) return true
    }

    // One-way substring match on sanitized input (handles partial typing)
    const sanitizedQ = sanitizeSubjectInput(q)
    if (subjectKey.includes(sanitizedQ)) return true

    // Match board name or offering label
    const subjectOffs = offeringsBySubject.get(subject.id) || []
    for (const off of subjectOffs) {
      if (off.qualificationId !== studyMode) continue
      const board = boardMap.get(off.boardId)
      if (board && board.name.toLowerCase().includes(q)) return true
      if (off.label.toLowerCase().includes(q)) return true
    }

    return false
  }, [searchQuery, offeringsBySubject, boardMap, studyMode])

  const filteredSeededSubjects = useMemo(
    () => seededSubjects.filter(matchesSearch),
    [seededSubjects, matchesSearch],
  )

  const filteredCustomSubjects = useMemo(
    () => customSubjects.filter(matchesSearch),
    [customSubjects, matchesSearch],
  )

  // Unified subject list: seeded first, then custom
  const filteredSubjects = useMemo(
    () => [...filteredSeededSubjects, ...filteredCustomSubjects],
    [filteredSeededSubjects, filteredCustomSubjects],
  )

  // Normalized matches for search empty state — structurally split
  const searchNormalizedMatches = useMemo(() => {
    const q = searchQuery.trim()
    if (!q || !studyMode) return { authoritative: [], suggestions: [] }
    return findNormalizedMatches(q, subjects, offerings, studyMode, 'interactive')
  }, [searchQuery, subjects, offerings, studyMode])

  // Configuration completeness
  const configuredSubjectIds = useMemo(() => {
    const set = new Set<string>()
    for (const sid of selectedSubjectIds) {
      const oid = chosenOffering.get(sid)
      if (oid && confidences.has(oid)) {
        set.add(sid)
      }
    }
    return set
  }, [selectedSubjectIds, chosenOffering, confidences])

  const unconfiguredSelectedIds = useMemo(() => {
    const ids: string[] = []
    // Preserve list order: seeded then custom
    const allVisible = [...seededSubjects, ...customSubjects]
    for (const s of allVisible) {
      if (selectedSubjectIds.has(s.id) && !configuredSubjectIds.has(s.id)) {
        ids.push(s.id)
      }
    }
    return ids
  }, [selectedSubjectIds, configuredSubjectIds, seededSubjects, customSubjects])

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

  // Handlers
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
        const subjectOffs = (offeringsBySubject.get(subjectId) || []).filter(o => o.qualificationId === studyMode)
        if (subjectOffs.length === 1) {
          setChosenOffering((m) => new Map(m).set(subjectId, subjectOffs[0].id))
        }
      } else {
        next.delete(subjectId)
        setChosenOffering((m) => { const n = new Map(m); n.delete(subjectId); return n })
        const subjectOffs = offeringsBySubject.get(subjectId) || []
        setConfidences((prev) => {
          const n = new Map(prev)
          for (const o of subjectOffs) n.delete(o.id)
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
    // Auto-set confidence from existing topic data (for pending tier subjects that have no confidence yet)
    const offeringTopics = topics.filter((t) => t.offeringId === offeringId)
    if (offeringTopics.length > 0) {
      const avg = Math.round(offeringTopics.reduce((sum, t) => sum + t.confidence, 0) / offeringTopics.length)
      setConfidences((prev) => {
        if (prev.has(offeringId)) return prev
        return new Map(prev).set(offeringId, Math.max(1, Math.min(5, avg)))
      })
    }
  }

  const setConfidence = (offeringId: string, level: number) => {
    setConfidences((prev) => new Map(prev).set(offeringId, level))
  }

  const handleDeleteCustom = (subjectId: string) => {
    if (!window.confirm('Remove this custom subject and all its data?')) return
    const offeringIds = (offeringsBySubject.get(subjectId) ?? []).map(o => o.id)
    setSelectedSubjectIds(prev => { const next = new Set(prev); next.delete(subjectId); return next })
    setChosenOffering(prev => { const next = new Map(prev); next.delete(subjectId); return next })
    setConfidences(prev => { const next = new Map(prev); offeringIds.forEach(id => next.delete(id)); return next })
    setExpandedCards(prev => { const next = new Set(prev); next.delete(subjectId); return next })
    if (subjectId.startsWith('draft-')) {
      setDrafts(prev => prev.filter(d => d.subject?.id !== subjectId))
    } else {
      removeCustomSubject(subjectId)
    }
  }

  // Mobile-specific handlers
  const openSubjectConfig = useCallback((subjectId: string) => {
    // Auto-select if not already selected
    if (!selectedSubjectIds.has(subjectId)) {
      setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
      // Auto-bind single offering (confidence left unset — user must choose)
      const subjectOffs = (offeringsBySubject.get(subjectId) || []).filter(o => o.qualificationId === studyMode)
      if (subjectOffs.length === 1) {
        setChosenOffering(m => new Map(m).set(subjectId, subjectOffs[0].id))
      }
    }
    setActiveSubjectId(subjectId)
    setMobileStep('configure')
  }, [selectedSubjectIds, offeringsBySubject, studyMode])

  const removeFromConfig = useCallback((subjectId: string) => {
    if (subjectId.startsWith('draft-')) {
      // Draft custom: delete entirely
      const offeringIds = (offeringsBySubject.get(subjectId) ?? []).map(o => o.id)
      setSelectedSubjectIds(prev => { const next = new Set(prev); next.delete(subjectId); return next })
      setChosenOffering(prev => { const next = new Map(prev); next.delete(subjectId); return next })
      setConfidences(prev => { const next = new Map(prev); offeringIds.forEach(id => next.delete(id)); return next })
      setDrafts(prev => prev.filter(d => d.subject?.id !== subjectId))
    } else {
      // Seeded/persisted: deselect
      setSelectedSubjectIds(prev => { const next = new Set(prev); next.delete(subjectId); return next })
      setChosenOffering(prev => { const next = new Map(prev); next.delete(subjectId); return next })
      const subjectOffs = offeringsBySubject.get(subjectId) || []
      setConfidences(prev => {
        const next = new Map(prev)
        for (const o of subjectOffs) next.delete(o.id)
        return next
      })
    }
    setActiveSubjectId(null)
    setMobileStep('pick')
  }, [offeringsBySubject])

  const getBoardDisplayName = useCallback((offeringId: string): string => {
    const off = offerings.find(o => o.id === offeringId)
    if (!off) return ''
    const board = boardMap.get(off.boardId)
    return board?.name ?? off.boardId
  }, [offerings, boardMap])

  const canFinish = (isEdit || selectedSubjectIds.size > 0) &&
    [...selectedSubjectIds].every((sid) => {
      // Pending tier subjects can be saved without explicit tier choice (stays pending)
      if (pendingTierConfirmations.has(sid) && !chosenOffering.has(sid)) return true
      const oid = chosenOffering.get(sid)
      return oid !== undefined && confidences.has(oid)
    })

  const handleFinish = () => {
    // Pre-process pending tier confirmations before main save
    // This ensures tier-aware actions run with compat state intact
    for (const subjectId of Array.from(pendingTierConfirmations)) {
      if (selectedSubjectIds.has(subjectId)) {
        const oid = chosenOffering.get(subjectId)
        if (oid) {
          confirmTierSelection(subjectId, oid)
        }
      } else {
        dismissPendingSubject(subjectId)
      }
    }

    // Persist drafts
    const draftIdMap = new Map<string, { subjectId: string; offeringId: string }>()
    const subjectIdRemap = new Map<string, string>() // draft subject ID → real subject ID
    for (const draft of drafts) {
      const draftSubjectId = draft.subject?.id ?? draft.data.existingSubjectId
      if (!draftSubjectId || !selectedSubjectIds.has(draftSubjectId)) continue

      if (draft.data.existingSubjectId) {
        // Resolve draft-* subject IDs to their persisted counterparts
        const resolvedSubjectId = subjectIdRemap.get(draft.data.existingSubjectId) ?? draft.data.existingSubjectId
        const result = addOfferingToSubject(resolvedSubjectId, {
          ...draft.data,
          qualificationId: localStudyMode!,
        })
        if (result) {
          draftIdMap.set(draft.offering.id, { subjectId: resolvedSubjectId, offeringId: result.offeringId })
        }
      } else {
        const result = addCustomSubject({
          ...draft.data,
          confidence: draft.data.confidence ?? 3,
          qualificationId: localStudyMode!,
        })
        draftIdMap.set(draft.offering.id, result)
        // Record remap: draft subject ID → real subject ID
        if (draft.subject?.id) {
          subjectIdRemap.set(draft.subject.id, result.subjectId)
        }
      }
    }

    const offeringIds: string[] = []
    const storeState = useAppStore.getState()
    for (const sid of selectedSubjectIds) {
      const chosenOid = chosenOffering.get(sid)
      if (chosenOid) {
        const mapped = draftIdMap.get(chosenOid)
        offeringIds.push(mapped ? mapped.offeringId : chosenOid)
      } else if (pendingTierConfirmations.has(sid)) {
        // Still-pending subject with no tier choice: inject both compat offerings
        // so updateSelectedOfferings preserves them (signals "keep pending")
        const compat = storeState.compatSelectedOfferingIds.get(sid)
        if (compat) {
          for (const oid of compat) {
            if (!offeringIds.includes(oid)) offeringIds.push(oid)
          }
        }
      }
    }

    const finalConf = new Map<string, number>()
    for (const oid of offeringIds) {
      // Find confidence: check if this was a remapped draft
      const draftOid = [...draftIdMap.entries()].find(([, v]) => v.offeringId === oid)?.[0]
      if (draftOid) {
        finalConf.set(oid, confidences.get(draftOid) ?? 3)
      } else {
        finalConf.set(oid, confidences.get(oid) ?? 3)
      }
    }
    if (isEdit) {
      // Store-level guards in updateSelectedOfferings handle any remaining tier-split offerings
      updateSelectedOfferings(offeringIds, finalConf)
    } else {
      if (localStudyMode) setStudyModeInStore(localStudyMode)
      // Store-level guards in completeOnboarding handle any remaining tier-split offerings
      completeOnboarding(offeringIds, finalConf)
    }
    onComplete()
  }

  const resetForQualificationChange = () => {
    setDrafts([])
    setSelectedSubjectIds(new Set())
    setChosenOffering(new Map())
    setConfidences(new Map())
    setExpandedCards(new Set())
    setSearchQuery('')
    setMobileStep('pick')
    setActiveSubjectId(null)
  }

  const openWizard = (initialName = '') => {
    setWizardMode({ kind: 'create-subject', initialSubjectName: initialName })
  }

  const openAddBoard = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId)
    if (!subject) return
    setWizardMode({ kind: 'add-offering', subjectId, subjectName: subject.name })
  }

  const openEditBoard = (offeringId: string) => {
    if (!offeringId.startsWith('custom-offering-')) return
    const offering = offerings.find(o => o.id === offeringId)
    if (!offering) return
    const subject = subjects.find(s => s.id === offering.subjectId)
    if (!subject) return
    const paper = papers.find(p => p.offeringId === offeringId)
    const offeringTopics = useAppStore.getState().topics.filter(t => t.offeringId === offeringId)
    setWizardMode({
      kind: 'edit-offering',
      offeringId,
      subjectId: offering.subjectId,
      subjectName: subject.name,
      prefill: {
        boardLabel: offering.label,
        paper: paper ? { name: paper.name, examDate: paper.examDate, examTime: paper.examTime } : { name: 'Paper 1', examDate: '' },
        topicNames: offeringTopics.map(t => t.name),
      },
    })
  }

  const handleRemoveOffering = (offeringId: string) => {
    const offering = offerings.find(o => o.id === offeringId)
    if (!offering) return

    if (offeringId.startsWith('draft-offering-')) {
      // Remove draft
      setDrafts(prev => prev.filter(d => d.offering.id !== offeringId))
    } else if (offeringId.startsWith('custom-offering-')) {
      if (!window.confirm('Remove this board and all its topics?')) return
      removeOfferingFromStore(offeringId)
    } else {
      return // seeded: no remove
    }

    // Local cleanup
    const subjectId = offering.subjectId
    setChosenOffering(prev => { const n = new Map(prev); n.delete(subjectId); return n })
    setConfidences(prev => { const n = new Map(prev); n.delete(offeringId); return n })
    // Keep in selectedSubjectIds → "Needs setup"

    // If wizard targets this offering, close it
    if (wizardMode?.kind === 'edit-offering' && wizardMode.offeringId === offeringId) {
      setWizardMode(null)
    }
  }

  const handleDraftCreated = (data: CustomSubjectDraftData) => {
    setWizardMode(null)
    const key = crypto.randomUUID()

    // If adding offering to existing subject
    if (data.existingSubjectId) {
      const offeringId = `draft-offering-${key}`
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

      const specLabel = data.spec?.trim() ?? ''
      const draft: CustomSubjectDraft = {
        key,
        data,
        subject: null, // no synthetic subject needed
        offering: {
          id: offeringId,
          subjectId: data.existingSubjectId,
          boardId,
          spec: specLabel,
          label: `${boardName} ${specLabel}`.trim(),
          qualificationId: studyMode!,
        },
        papers: [{
          id: `draft-paper-${key}-0`,
          offeringId,
          name: data.paper.name,
          examDate: data.paper.examDate,
          ...(data.paper.examTime ? { examTime: data.paper.examTime } : {}),
        }],
        board: newBoard,
      }

      setDrafts(prev => [...prev, draft])
      setSelectedSubjectIds(prev => new Set(prev).add(data.existingSubjectId!))
      setChosenOffering(prev => new Map(prev).set(data.existingSubjectId!, offeringId))
      // No confidence auto-fill — subject shows "Needs setup"
      setExpandedCards(prev => new Set(prev).add(data.existingSubjectId!))
      return
    }

    // Create new subject draft
    const subjectId = `draft-${key}`
    const offeringId = `draft-offering-${key}`

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
      papers: [{
        id: `draft-paper-${key}-0`,
        offeringId,
        name: data.paper.name,
        examDate: data.paper.examDate,
        ...(data.paper.examTime ? { examTime: data.paper.examTime } : {}),
      }],
      board: newBoard,
    }

    setDrafts(prev => [...prev, draft])
    setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
    setChosenOffering(prev => new Map(prev).set(subjectId, offeringId))
    if (data.confidence !== undefined) {
      setConfidences(prev => new Map(prev).set(offeringId, data.confidence!))
    }
    setExpandedCards(prev => new Set(prev).add(subjectId))
  }

  const handleExistingOffering = (subjectId: string, offeringId: string) => {
    setWizardMode(null)
    setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
    // Mirror selectOffering: clear stale confidence when switching boards
    const oldOid = chosenOffering.get(subjectId)
    if (oldOid && oldOid !== offeringId) {
      setConfidences(prev => { const n = new Map(prev); n.delete(oldOid); return n })
    }
    setChosenOffering(prev => new Map(prev).set(subjectId, offeringId))
    setExpandedCards(prev => new Set(prev).add(subjectId))
    setActiveSubjectId(subjectId)
    setMobileStep('configure')
    // Scroll to the card after React flushes the state updates
    requestAnimationFrame(() => {
      document.querySelector(`[data-subject-id="${subjectId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleWizardCreated = ({ subjectId, offeringId, confidence }: { subjectId: string; offeringId: string; confidence?: number }) => {
    setWizardMode(null)
    setSelectedSubjectIds(prev => new Set(prev).add(subjectId))
    setChosenOffering(prev => new Map(prev).set(subjectId, offeringId))
    if (confidence !== undefined) {
      setConfidences(prev => new Map(prev).set(offeringId, confidence))
    }
    setExpandedCards(prev => new Set(prev).add(subjectId))
  }

  return {
    // State
    isEdit,
    studyMode,
    localStudyMode,
    setLocalStudyMode,
    wizardMode,
    setWizardMode,
    drafts,
    subjects,
    offerings,
    papers,
    boards,
    selectedSubjectIds,
    chosenOffering,
    confidences,
    expandedCards,
    searchQuery,
    setSearchQuery,
    mobileStep,
    setMobileStep,
    activeSubjectId,
    setActiveSubjectId,
    scrollPositionRef,
    persistedStudyMode,
    pendingTierConfirmations,

    // Derived
    boardMap,
    offeringsBySubject,
    visibleOfferings,
    visibleSubjectIds,
    seededSubjects,
    customSubjects,
    filteredSubjects,
    filteredSeededSubjects,
    filteredCustomSubjects,
    searchNormalizedMatches,
    offeringMeta,
    papersByOffering,
    nearestExamByOffering,
    configuredSubjectIds,
    unconfiguredSelectedIds,
    canFinish,

    // Handlers
    toggleExpanded,
    setSelected,
    selectOffering,
    setConfidence,
    handleDeleteCustom,
    handleFinish,
    openSubjectConfig,
    removeFromConfig,
    getBoardDisplayName,
    resetForQualificationChange,
    openWizard,
    openAddBoard,
    openEditBoard,
    handleRemoveOffering,
    handleDraftCreated,
    handleWizardCreated,
    handleExistingOffering,
  }
}

export type OnboardingController = ReturnType<typeof useOnboardingController>
