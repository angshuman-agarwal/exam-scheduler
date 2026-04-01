import type { Offering, Paper, PaperAttemptSource, ScheduleSource, ScoredTopic, Subject } from './index'

export interface ActiveTopicSessionState {
  kind: 'topic'
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
}

export interface ActivePaperSessionState {
  kind: 'paper'
  paper: Paper
  offering: Offering
  subject: Subject
  source: PaperAttemptSource
  selectionRequired?: boolean
  restored?: boolean
}

export type ActiveSessionState = ActiveTopicSessionState | ActivePaperSessionState
