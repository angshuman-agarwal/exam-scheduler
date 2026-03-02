import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/app.store'
import type { ScoredTopic, ScheduleSource } from '../types'

interface SessionLoggerProps {
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
  onBack: () => void
}

function getEncouragement(score: number): string {
  if (score >= 80) return 'Brilliant work!'
  if (score >= 60) return 'Nice work!'
  if (score >= 40) return 'Good effort — keep going!'
  return "Tough one — you'll get there!"
}

function getNextStep(score: number): string {
  if (score >= 80) return "Nice — we'll focus on other topics for now."
  if (score >= 50) return "Solid session. We'll revisit this one soon."
  return "No worries — we'll keep this in your rotation."
}

function ConfidenceDots({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= value ? color : '#d1d5db' }}>
          {i <= value ? '●' : '○'}
        </span>
      ))}
    </span>
  )
}

export default function SessionLogger({ scored, source, scheduleItemId, onBack }: SessionLoggerProps) {
  const { topic, subject } = scored
  const logSession = useAppStore((s) => s.logSession)
  const addNote = useAppStore((s) => s.addNote)
  const removeFromPlan = useAppStore((s) => s.removeFromPlan)

  const mountTime = useRef(0)
  useEffect(() => {
    mountTime.current = Date.now()
  }, [])
  const [sliderValue, setSliderValue] = useState(50)
  const [submitted, setSubmitted] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [confidenceBefore] = useState(topic.confidence)
  const [backgroundAlert, setBackgroundAlert] = useState(false)

  // Visibility detection — notify when user tabs away during session
  useEffect(() => {
    if (submitted) return

    let hasNotifiedThisBackground = false

    const handler = () => {
      if (document.hidden) {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
        if (!hasNotifiedThisBackground) {
          hasNotifiedThisBackground = true
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Session still running', {
              body: 'Your study session is still going.',
            })
          }
        }
      } else {
        if (hasNotifiedThisBackground && (
          !('Notification' in window) || Notification.permission !== 'granted'
        )) {
          setBackgroundAlert(true)
        }
        hasNotifiedThisBackground = false
      }
    }

    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [submitted])

  const handleSubmit = () => {
    const elapsed = Math.round((Date.now() - mountTime.current) / 1000)
    const durationSeconds = elapsed > 10800 ? undefined : elapsed
    logSession(topic.id, sliderValue, new Date(), durationSeconds, source)
    if (noteText.trim()) {
      addNote(topic.id, noteText.trim())
    }
    if (scheduleItemId) {
      removeFromPlan(scheduleItemId)
    }
    setSubmitted(true)
  }

  // Get updated confidence after submission
  const topics = useAppStore((s) => s.topics)
  const updatedTopic = submitted ? topics.find((t) => t.id === topic.id) : null
  const confidenceAfter = updatedTopic?.confidence ?? confidenceBefore

  return (
    <div className="px-4 pt-6 min-h-screen bg-gray-50">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-6 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: subject.color }} />
        <div>
          <h2 className="text-xl font-bold text-gray-900">{topic.name}</h2>
          <p className="text-sm text-gray-500">{subject.name}</p>
        </div>
      </div>

      {/* In-app background alert */}
      {backgroundAlert && !submitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-blue-700">
            Welcome back — your session timer is still running.
          </p>
          <button
            onClick={() => setBackgroundAlert(false)}
            className="text-blue-400 hover:text-blue-600 ml-3 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {!submitted ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How did it go?
          </label>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between items-end text-xs text-gray-400 mt-1">
              <span>Struggled</span>
              <span className="text-3xl font-bold text-gray-900 leading-none">{sliderValue}</span>
              <span>Nailed it</span>
            </div>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Any notes? (optional)"
            rows={2}
            className="w-full mt-4 p-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={handleSubmit}
            className="w-full mt-6 py-3.5 bg-blue-600 text-white font-medium rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            Complete Topic
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-3">
            {getEncouragement(sliderValue)}
          </p>

          <div className="flex items-center justify-center gap-2 text-sm mb-3">
            <ConfidenceDots value={confidenceBefore} color={subject.color} />
            <span className="text-gray-400">{'→'}</span>
            <ConfidenceDots value={confidenceAfter} color={subject.color} />
          </div>

          <p className="text-sm text-gray-500 mb-4">
            {getNextStep(sliderValue)}
          </p>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => {
              if (noteText.trim()) {
                addNote(topic.id, noteText.trim())
                setNoteText('')
              }
            }}
            placeholder="Add a note? (optional)"
            rows={2}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={onBack}
            className="w-full mt-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200"
          >
            Back to Plan
          </button>
        </div>
      )}
    </div>
  )
}
