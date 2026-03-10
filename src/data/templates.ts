export interface SubjectTemplate {
  qualificationId: 'gcse' | 'alevel'
  subject: string
  boardId: 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'
  spec?: string
  papers?: { name: string; examDate?: string; examTime?: string }[]
  topics?: string[]
}

const ALIAS_MAP: Record<string, string> = {
  'psychology': 'psychology',
  'psych': 'psychology',
  'art': 'art and design',
  'art & design': 'art and design',
  'art and design': 'art and design',
  'maths': 'mathematics',
  'math': 'mathematics',
  'mathematics': 'mathematics',
  'rs': 'religious studies',
  're': 'religious studies',
  'religious education': 'religious studies',
  'religious studies': 'religious studies',
  'dt': 'design and technology',
  'd&t': 'design and technology',
  'd and t': 'design and technology',
  'design and technology': 'design and technology',
  'comp sci': 'computer science',
  'cs': 'computer science',
  'computing': 'computer science',
  'computer science': 'computer science',
  'pe': 'physical education',
  'phys ed': 'physical education',
  'physical education': 'physical education',
  'history': 'history',
}

export function normalizeSubject(name: string): string {
  const key = name.toLowerCase().trim()
  return ALIAS_MAP[key] ?? key
}

const TEMPLATES: SubjectTemplate[] = [
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'aqa',
    spec: '8145',
    papers: [
      { name: 'Paper 1', examDate: '2026-05-18' },
      { name: 'Paper 2', examDate: '2026-06-05' },
    ],
    topics: [
      'Germany 1890–1945',
      'Conflict and tension 1894–1918',
      'Elizabethan England',
      'Norman England',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'edexcel',
    spec: '1HI0',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-01' },
      { name: 'Paper 2', examDate: '2026-06-08' },
      { name: 'Paper 3', examDate: '2026-06-15' },
    ],
    topics: [
      'Medicine in Britain',
      'Early Elizabethan England',
      'Weimar and Nazi Germany',
      'Superpower relations and the Cold War',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'ocr',
    spec: 'J410',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-02' },
      { name: 'Paper 2', examDate: '2026-06-09' },
    ],
    topics: [
      'The People\'s Health',
      'The Elizabethans',
      'History Around Us',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'eduqas',
    spec: 'C100P',
    papers: [
      { name: 'Component 1', examDate: '2026-05-20' },
      { name: 'Component 2', examDate: '2026-06-04' },
    ],
    topics: [
      'Studies in depth',
      'Studies in breadth',
      'Thematic study',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'wjec',
    spec: 'C100P',
    papers: [
      { name: 'Unit 1', examDate: '2026-05-20' },
      { name: 'Unit 2', examDate: '2026-06-04' },
    ],
    topics: [
      'Studies in depth',
      'Studies in breadth',
      'Thematic study',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'psychology',
    boardId: 'aqa',
    spec: '8182',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-09' },
      { name: 'Paper 2', examDate: '2026-06-16' },
    ],
    topics: [
      'Memory',
      'Perception',
      'Development',
      'Research methods',
      'Social influence',
      'Language, thought and communication',
      'Brain and neuropsychology',
      'Psychological problems',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'art and design',
    boardId: 'aqa',
    spec: '8201',
    papers: [
      { name: 'Component 1 (Portfolio)' },
      { name: 'Component 2 (Externally set assignment)' },
    ],
    topics: [
      'Drawing and painting',
      'Printmaking',
      'Sculpture',
      'Photography',
      'Digital media',
      'Critical studies',
    ],
  },
]

type PresetBoardId = 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'

export function findTemplate(
  qualificationId: 'gcse' | 'alevel',
  subjectName: string,
  boardId: PresetBoardId,
): SubjectTemplate | null {
  const normalized = normalizeSubject(subjectName)
  return TEMPLATES.find(
    (t) =>
      t.qualificationId === qualificationId &&
      t.subject === normalized &&
      t.boardId === boardId,
  ) ?? null
}
