import type {
  GradeInput,
  GradeResult,
  LookupInput,
  LookupResult,
  MarkSchemeInput,
  MarkSchemeResult,
  QuizInput,
  QuizResult,
  SearchInput,
  SearchResultItem,
} from '../../lib/api/types'

export type StudyAssistantMode = 'lookup' | 'search' | 'quiz' | 'markscheme' | 'grade'

export type StudyAssistantStatus = 'idle' | 'loading' | 'success' | 'error'

export interface StudyAssistantResultState {
  search: SearchResultItem[] | null
  lookup: LookupResult | null
  quiz: QuizResult | null
  markscheme: MarkSchemeResult | null
  grade: GradeResult | null
}

export interface StudyAssistantState {
  isOpen: boolean
  mode: StudyAssistantMode
  status: StudyAssistantStatus
  error: string | null
  result: StudyAssistantResultState
}

export interface StudyAssistantActions {
  closeAssistant: () => void
  openAssistant: (mode?: StudyAssistantMode) => void
  resetAssistant: () => void
  runGrade: (input: GradeInput) => Promise<GradeResult>
  runLookup: (input: LookupInput) => Promise<LookupResult>
  runMarkscheme: (input: MarkSchemeInput) => Promise<MarkSchemeResult>
  runQuiz: (input: QuizInput) => Promise<QuizResult>
  runSearch: (input: SearchInput) => Promise<SearchResultItem[]>
  setMode: (mode: StudyAssistantMode) => void
}
