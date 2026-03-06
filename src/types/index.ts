export type ScheduleSource = 'auto' | 'suggested' | 'manual'

export interface ScheduleItem {
  id: string
  topicId: string
  source: ScheduleSource
  addedAt: number          // epoch ms
  dayKey: string           // YYYY-MM-DD local timezone (never UTC)
}

export interface Board {
  id: string
  name: string             // e.g. "AQA", "Edexcel", "OCR"
}

export interface Subject {
  id: string
  name: string
  color: string
}

export interface Offering {
  id: string
  subjectId: string
  boardId: string
  spec: string             // e.g. "8525", "1MA1"
  label: string            // display: "AQA 8525"
}

export interface Paper {
  id: string
  offeringId: string
  name: string
  examDate: string // ISO date
  examTime?: string // HH:mm 24-hour format
}

export interface Topic {
  id: string
  paperId: string
  offeringId: string
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
  offering: Offering
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

export interface SeedDataV2 {
  version: 2
  boards: Board[]
  subjects: Subject[]
  offerings: Offering[]
  papers: Paper[]
  topics: Topic[]
}
