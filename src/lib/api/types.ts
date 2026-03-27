import type { Board, Offering, Paper, ScheduleItem, Subject } from '../../types'

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
