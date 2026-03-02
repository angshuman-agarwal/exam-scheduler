export type ScheduleSource = 'auto' | 'suggested' | 'manual'

export interface ScheduleItem {
  id: string
  topicId: string
  source: ScheduleSource
  addedAt: number          // epoch ms
  dayKey: string           // YYYY-MM-DD local timezone (never UTC)
}

export interface Subject {
  id: string
  name: string
  color: string
  board: string
}

export interface Paper {
  id: string
  subjectId: string
  name: string
  examDate: string // ISO date
}

export interface Topic {
  id: string
  paperId: string
  subjectId: string
  name: string
  confidence: number // 1-5
  performanceScore: number // 0-1
  lastReviewed: string | null // ISO date
}

export interface Session {
  id: string
  topicId: string
  date: string // ISO date
  score: number // 0-1
  timestamp?: number // epoch ms, when session was logged
  durationSeconds?: number
  source?: ScheduleSource    // analytics only, optional for backward compat
}

export interface ScoredTopic {
  topic: Topic
  paper: Paper
  subject: Subject
  score: number
  blockType: 'deep' | 'recall'
  weakness: number
  recencyFactor: number
}

export interface DayPlan {
  deep: ScoredTopic[]
  recall: ScoredTopic[]
}

export interface UserState {
  energyLevel: number // 1-5
  stress: number // 1-5
}

export interface Note {
  id: string
  topicId: string
  date: string // ISO date
  text: string
}

export interface SeedData {
  subjects: Subject[]
  papers: Paper[]
  topics: Topic[]
}
