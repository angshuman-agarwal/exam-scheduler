import type { Board, Note, Offering, Paper, PaperAttempt, ScheduleItem, Session, Subject, Topic } from '../../types'

export interface NearestExamSummary {
  days: number
  subjectName: string
  paperName: string
  board: string
}

export interface SelectedSubjectSummary {
  name: string
  board: string
}

export interface SubjectsApi {
  getNearestExamSummary(input: {
    papers: Paper[]
    offerings: Offering[]
    subjects: Subject[]
    boards: Board[]
    selectedOfferingIds: string[]
    today: Date
  }): NearestExamSummary | null
  getSelectedSubjectSummaries(input: {
    offerings: Offering[]
    subjects: Subject[]
    boards: Board[]
    selectedOfferingIds: string[]
  }): SelectedSubjectSummary[]
}

export interface PlansApi {
  getPlanItems(input: {
    dailyPlan: ScheduleItem[]
    planDay: string
    today: Date
  }): ScheduleItem[]
}

export interface AccountContext {
  initialized: boolean
  onboarded: boolean
  studyMode: 'gcse' | 'alevel' | null
}

export interface ProgressContext {
  studyMode: 'gcse' | 'alevel' | null
  topics: Topic[]
  sessions: Session[]
  paperAttempts: PaperAttempt[]
  subjects: Subject[]
  papers: Paper[]
  offerings: Offering[]
  selectedOfferingIds: string[]
  notes: Note[]
}

export type TutoringContentType = 'quiz' | 'bbc'

export interface SearchInput {
  query: string
  subject?: string
  type?: TutoringContentType
  limit?: number
}

export interface SearchResultItem {
  id: string
  score: number
  type: TutoringContentType
  subject: string
  name: string
  slug: string
  file?: string
  dir?: string
}

export interface LookupInput {
  topic: string
  subject?: string
  maxTokens?: number
}

export interface LookupResult {
  topic: string
  subject: string
  name: string
  dir: string
  excerpt: string
  tokenCount: number
  source: 'cache'
}

interface QuizBaseInput {
  topic: string
  subject?: string
  question?: number
}

interface QuizBaseResult {
  topic: string
  subject: string
  matchedTopic: string
  file: string
  msFile: string | null
  transcriptFile: string | null
  audioFile: string | null
  transcript: string | null
  question: string
  questionNumber: number
  totalQuestions: number
}

export type QuizInput = QuizBaseInput

export type QuizResult = QuizBaseResult

export type MarkSchemeInput = QuizBaseInput

export interface MarkSchemeResult extends QuizBaseResult {
  markScheme: string
  totalMarkSchemes: number
}

export interface GradeInput extends QuizBaseInput {
  answer: string
}

export interface GradeResult extends QuizBaseResult {
  markScheme: string
  answer: string
  estimatedMarks: number | null
  maxMarks: number | null
  confidence: 'low' | 'medium' | 'high'
  matchedPoints: string[]
  missedPoints: string[]
  summary: string
}

export interface TutoringApi {
  search(input: SearchInput): Promise<SearchResultItem[]>
  lookup(input: LookupInput): Promise<LookupResult>
  quiz(input: QuizInput): Promise<QuizResult>
  markscheme(input: MarkSchemeInput): Promise<MarkSchemeResult>
  grade(input: GradeInput): Promise<GradeResult>
}

export class TutoringApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TutoringApiError'
    this.code = code
  }
}
