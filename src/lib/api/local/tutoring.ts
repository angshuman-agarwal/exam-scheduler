import type {
  LookupInput,
  LookupResult,
  MarkSchemeInput,
  MarkSchemeResult,
  QuizInput,
  QuizResult,
  SearchInput,
  SearchResultItem,
  TutoringApi,
  GradeInput,
  GradeResult,
} from '../types'

export const localTutoringApi: TutoringApi = {
  async search(input: SearchInput): Promise<SearchResultItem[]> {
    void input
    return []
  },
  async lookup(input: LookupInput): Promise<LookupResult> {
    return {
      topic: input.topic,
      subject: input.subject ?? '',
      name: input.topic,
      dir: '',
      excerpt: '',
      tokenCount: 0,
      source: 'cache',
    }
  },
  async quiz(input: QuizInput): Promise<QuizResult> {
    return {
      topic: input.topic,
      subject: input.subject ?? '',
      matchedTopic: input.topic,
      file: '',
      msFile: null,
      transcriptFile: null,
      audioFile: null,
      transcript: null,
      question: '',
      questionNumber: input.question ?? 1,
      totalQuestions: 0,
    }
  },
  async markscheme(input: MarkSchemeInput): Promise<MarkSchemeResult> {
    return {
      topic: input.topic,
      subject: input.subject ?? '',
      matchedTopic: input.topic,
      file: '',
      msFile: null,
      transcriptFile: null,
      audioFile: null,
      transcript: null,
      question: '',
      markScheme: '',
      questionNumber: input.question ?? 1,
      totalQuestions: 0,
      totalMarkSchemes: 0,
    }
  },
  async grade(input: GradeInput): Promise<GradeResult> {
    return {
      topic: input.topic,
      subject: input.subject ?? '',
      matchedTopic: input.topic,
      file: '',
      msFile: null,
      transcriptFile: null,
      audioFile: null,
      transcript: null,
      question: '',
      markScheme: '',
      answer: input.answer,
      estimatedMarks: null,
      maxMarks: null,
      confidence: 'low',
      matchedPoints: [],
      missedPoints: [],
      summary: '',
      questionNumber: input.question ?? 1,
      totalQuestions: 0,
    }
  },
}
