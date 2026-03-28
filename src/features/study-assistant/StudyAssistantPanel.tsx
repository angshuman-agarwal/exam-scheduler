import type { StudyAssistantMode } from './types'

interface StudyAssistantPanelProps {
  currentPage: string
  error: string | null
  isOpen: boolean
  mode: StudyAssistantMode
  onClose: () => void
  onOpenMode: (mode: StudyAssistantMode) => void
  subjectCount: number
  tutoringReady: boolean
}

const PROMPT_SUGGESTIONS: Record<string, Array<{ label: string; mode: StudyAssistantMode }>> = {
  home: [
    { label: 'What should I revise next?', mode: 'progress' },
    { label: 'How am I doing overall?', mode: 'progress' },
  ],
  progress: [
    { label: 'Explain my weak areas', mode: 'progress' },
    { label: 'What changed this week?', mode: 'progress' },
  ],
  today: [
    { label: 'Quiz me on today’s plan', mode: 'quiz' },
    { label: 'Help with my next topic', mode: 'lookup' },
  ],
}

function getContextCopy(currentPage: string, subjectCount: number) {
  if (currentPage === 'today') {
    return 'Open planner guidance or tutor help without leaving today’s flow.'
  }

  if (currentPage === 'progress') {
    return 'Ask about weak areas, revision trends, and where to focus next.'
  }

  return subjectCount > 0
    ? `Ask for help across your ${subjectCount} active subject${subjectCount === 1 ? '' : 's'}.`
    : 'Ask for help with revision, quizzes, and markscheme support.'
}

function getModeSummary(mode: StudyAssistantMode) {
  switch (mode) {
    case 'progress':
      return 'planner guidance'
    case 'quiz':
      return 'quiz support'
    case 'lookup':
      return 'topic help'
    case 'markscheme':
      return 'markscheme help'
    case 'grade':
      return 'answer feedback'
    default:
      return 'study support'
  }
}

export default function StudyAssistantPanel({
  currentPage,
  error,
  isOpen,
  mode,
  onClose,
  onOpenMode,
  subjectCount,
  tutoringReady,
}: StudyAssistantPanelProps) {
  if (!isOpen) return null

  const suggestions = PROMPT_SUGGESTIONS[currentPage] ?? PROMPT_SUGGESTIONS.home

  return (
    <>
      <button
        type="button"
        aria-label="Close study assistant"
        className="fixed inset-0 z-[70] bg-slate-900/18 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
      />
      <section
        id="study-assistant-panel"
        data-testid="study-assistant-panel"
        className="fixed inset-0 z-[80] flex flex-col bg-white/97 shadow-[0_28px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[24.5rem] lg:border-l lg:border-slate-200"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,_#f4fbff_0%,_#d6efff_18%,_#79b6ff_38%,_#5e72ff_68%,_#7463ff_100%)] text-white shadow-[0_12px_24px_rgba(75,106,255,0.2)]">
              <span className="absolute inset-[-7px] rounded-full bg-[radial-gradient(circle,_rgba(93,170,255,0.16),_rgba(93,170,255,0)_66%)] opacity-80 blur-[4px]" />
              <span className="text-[1.1rem] leading-none text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]">
                ✦
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Study Assistant</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {getContextCopy(currentPage, subjectCount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close help panel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            onClick={onClose}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 lg:px-6">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="max-w-[90%] rounded-[1.5rem] rounded-tl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-sm">
              Hi. I’m here for both planner guidance and tutor help. Ask naturally and I’ll guide you with the right kind of support.
            </div>

            <div className="self-end rounded-[1.5rem] rounded-tr-md bg-blue-600 px-4 py-4 text-sm leading-relaxed text-white shadow-[0_16px_28px_rgba(37,99,235,0.16)]">
              {suggestions[0]?.label ?? 'What should I revise next?'}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold capitalize text-slate-900">{getModeSummary(mode)}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {tutoringReady
                  ? 'The conversation shell is ready. Live planner and tutor responses will slot into this stream next.'
                  : 'The assistant shell is ready. Tutor tools will connect here once the backend is enabled.'}
              </p>
              {error && (
                <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Suggested prompts
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((entry, index) => (
                  <button
                    key={entry.label}
                    type="button"
                    data-testid={index === 0 ? 'study-assistant-suggestion-primary' : undefined}
                    onClick={() => onOpenMode(entry.mode)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-blue-100 hover:text-blue-700"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 lg:px-6">
          <div className="mx-auto max-w-md rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <input
                data-testid="study-assistant-input"
                readOnly
                value=""
                aria-label="Ask the study assistant"
                placeholder="Ask about your plan or subjects..."
                className="w-full border-0 bg-transparent p-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.2)]"
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
