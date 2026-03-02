import { useState } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining } from '../lib/engine'

function pastel(hex: string, alpha = 0.25): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const subjects = useAppStore((s) => s.subjects)
  const papers = useAppStore((s) => s.papers)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)

  // Nearest exam date per subject
  const nearestExam = new Map<string, { date: string; days: number }>()
  const today = new Date()
  for (const p of papers) {
    const days = daysRemaining(p.examDate, today)
    const prev = nearestExam.get(p.subjectId)
    if (!prev || days < prev.days) {
      nearestExam.set(p.subjectId, { date: p.examDate, days })
    }
  }

  const [confidences, setConfidences] = useState<Map<string, number>>(() => new Map())

  const setConfidence = (subjectId: string, level: number) => {
    setConfidences((prev) => new Map(prev).set(subjectId, level))
  }

  const handleFinish = () => {
    const ids = subjects.map((s) => s.id)
    const finalConf = new Map<string, number>()
    for (const id of ids) {
      finalConf.set(id, confidences.get(id) ?? 3)
    }
    completeOnboarding(ids, finalConf)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-10 pb-8 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Let's build your study plan</h1>
      <p className="text-sm text-gray-500 mb-5">Tap a face to rate how you feel about each subject</p>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {subjects.map((s) => {
          const conf = confidences.get(s.id) ?? 3
          const touched = confidences.has(s.id)
          const exam = nearestExam.get(s.id)
          const fmtDate = exam
            ? new Date(exam.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : null

          let urgencyClass = 'text-gray-400'
          if (exam) {
            if (exam.days < 14) urgencyClass = 'text-red-500 font-semibold'
            else if (exam.days < 30) urgencyClass = 'text-amber-500 font-medium'
          }

          return (
            <div
              key={s.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all duration-200 ${
                touched ? 'border-gray-200 shadow-md' : 'border-gray-100'
              }`}
            >
              {/* Color bar */}
              <div className="h-1 rounded-t-xl transition-all duration-200" style={{ backgroundColor: touched ? s.color : pastel(s.color, 0.4) }} />

              <div className="px-3 pt-2 pb-2.5 flex flex-col flex-1">
                {/* Subject name */}
                <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>

                {/* Exam date + days remaining */}
                {exam && (
                  <p className="text-xs mt-0.5">
                    <span className="font-medium text-gray-700">{fmtDate}</span>
                    <span className="text-gray-300"> · </span>
                    <span className={urgencyClass}>{exam.days} days</span>
                  </p>
                )}

                {/* Confidence emojis */}
                <div className="flex justify-between mt-auto pt-1">
                  {(['😰', '😕', '😐', '🙂', '😎'] as const).map((emoji, i) => {
                    const level = i + 1
                    const selected = level === conf
                    return (
                      <button
                        key={level}
                        onClick={() => {
                          if (level === conf) setConfidence(s.id, level - 1)
                          else setConfidence(s.id, level)
                        }}
                        className={`text-lg leading-none p-1 rounded-md transition-all duration-150 ${
                          selected
                            ? 'scale-125 drop-shadow-sm'
                            : 'opacity-40 grayscale'
                        }`}
                        aria-label={`Set ${s.name} confidence to ${level}`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleFinish}
        className="w-full mt-5 py-3.5 bg-blue-500 text-white font-medium rounded-xl transition-colors hover:bg-blue-600 active:bg-blue-700"
      >
        Start studying
      </button>
    </div>
  )
}
