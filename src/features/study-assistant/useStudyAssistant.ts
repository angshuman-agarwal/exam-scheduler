import { useState } from 'react'
import { TutoringApiError, type GradeInput, type GradeResult, type LookupInput, type LookupResult, type MarkSchemeInput, type MarkSchemeResult, type QuizInput, type QuizResult, type SearchInput, type SearchResultItem, type TutoringApi } from '../../lib/api/types'
import { useTutoringApi } from '../../lib/api/local/useTutoringApi'
import { getStudyAssistantAvailability } from './config'
import type { StudyAssistantActions, StudyAssistantMode, StudyAssistantResultState, StudyAssistantState } from './types'

function createEmptyResultState(): StudyAssistantResultState {
  return {
    search: null,
    lookup: null,
    quiz: null,
    markscheme: null,
    grade: null,
  }
}

export function createInitialStudyAssistantState(): StudyAssistantState {
  const availability = getStudyAssistantAvailability()

  return {
    isEnabled: availability.enabled,
    isOpen: false,
    mode: 'search',
    status: 'idle',
    tutoringReady: availability.tutoringReady,
    error: null,
    result: createEmptyResultState(),
  }
}

export function useStudyAssistant(api?: TutoringApi): StudyAssistantState & StudyAssistantActions {
  const defaultApi = useTutoringApi()
  const tutoringApi = api ?? defaultApi
  const [state, setState] = useState<StudyAssistantState>(createInitialStudyAssistantState)

  async function runRequest<T>(
    mode: StudyAssistantMode,
    request: () => Promise<T>,
    applyResult: (result: T) => StudyAssistantResultState,
  ) {
    setState((current) => ({
      ...current,
      isOpen: true,
      mode,
      status: 'loading',
      error: null,
    }))

    try {
      const result = await request()
      setState((current) => ({
        ...current,
        isOpen: true,
        mode,
        status: 'success',
        error: null,
        result: applyResult(result),
      }))
      return result
    } catch (error) {
      const message =
        error instanceof TutoringApiError
          ? error.code === 'TUTORING_API_NOT_CONFIGURED'
            ? 'Tutor tools are not connected yet.'
            : error.message
          : 'Study assistant request failed.'
      setState((current) => ({
        ...current,
        isOpen: true,
        mode,
        status: 'error',
        error: message,
      }))
      throw error
    }
  }

  return {
    ...state,
    closeAssistant() {
      setState((current) => ({
        ...current,
        isOpen: false,
      }))
    },
    openAssistant(mode = state.mode) {
      setState((current) => ({
        ...current,
        isOpen: true,
        mode,
      }))
    },
    resetAssistant() {
      setState(createInitialStudyAssistantState())
    },
    runGrade(input: GradeInput): Promise<GradeResult> {
      return runRequest('grade', () => tutoringApi.grade(input), (result) => ({
        ...createEmptyResultState(),
        grade: result,
      }))
    },
    runLookup(input: LookupInput): Promise<LookupResult> {
      return runRequest('lookup', () => tutoringApi.lookup(input), (result) => ({
        ...createEmptyResultState(),
        lookup: result,
      }))
    },
    runMarkscheme(input: MarkSchemeInput): Promise<MarkSchemeResult> {
      return runRequest('markscheme', () => tutoringApi.markscheme(input), (result) => ({
        ...createEmptyResultState(),
        markscheme: result,
      }))
    },
    runQuiz(input: QuizInput): Promise<QuizResult> {
      return runRequest('quiz', () => tutoringApi.quiz(input), (result) => ({
        ...createEmptyResultState(),
        quiz: result,
      }))
    },
    runSearch(input: SearchInput): Promise<SearchResultItem[]> {
      return runRequest('search', () => tutoringApi.search(input), (result) => ({
        ...createEmptyResultState(),
        search: result,
      }))
    },
    setMode(mode: StudyAssistantMode) {
      setState((current) => ({
        ...current,
        mode,
      }))
    },
  }
}
