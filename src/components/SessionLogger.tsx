import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app.store'
import type { ScoredTopic, ScheduleSource } from '../types'

interface SessionLoggerProps {
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
  onBack: () => void
}

type Phase = 'pre' | 'active' | 'post'

const EMOJIS = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60E}']
const SCORE_MAP = [15, 35, 55, 75, 95]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getEncouragement(score: number): string {
  if (score >= 80) return 'Brilliant work!'
  if (score >= 60) return 'Nice work!'
  if (score >= 40) return 'Good effort \u2014 keep going!'
  return "Tough one \u2014 you'll get there!"
}

function getNextStep(score: number): string {
  if (score >= 80) return "Nice \u2014 we'll focus on other topics for now."
  if (score >= 50) return "Solid session. We'll revisit this one soon."
  return "No worries \u2014 we'll keep this in your rotation."
}

function ConfidenceDots({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= value ? color : '#d1d5db' }}>
          {i <= value ? '\u25CF' : '\u25CB'}
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

  const [phase, setPhase] = useState<Phase>('pre')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [confidenceLevel, setConfidenceLevel] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [discardBanner, setDiscardBanner] = useState(false)
  const [confidenceBefore] = useState(topic.confidence)
  const startTimeRef = useRef<number | null>(null)
  const pauseHeartbeatRef = useRef(false)

  // --- Timer (drift-safe) ---
  useEffect(() => {
    if (phase !== 'active') return
    startTimeRef.current = Date.now()
    const id = setInterval(() => {
      if (startTimeRef.current == null) return
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // --- Heartbeat background detection ---
  const discardSession = useCallback(() => {
    startTimeRef.current = null
    setElapsedSeconds(0)
    setPhase('pre')
    setDiscardBanner(true)
  }, [])

  useEffect(() => {
    if (phase !== 'active') return
    let lastTick = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (pauseHeartbeatRef.current) {
        lastTick = now
        return
      }
      if (now - lastTick > 3000) {
        discardSession()
      }
      lastTick = now
    }, 1000)
    return () => clearInterval(id)
  }, [phase, discardSession])

  // --- Visibility fallback ---
  useEffect(() => {
    if (phase !== 'active') return
    const handler = () => {
      if (document.hidden) discardSession()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [phase, discardSession])

  // --- Back button ---
  const handleBack = () => {
    if (phase === 'active') {
      if (elapsedSeconds >= 5) {
        pauseHeartbeatRef.current = true
        const confirmed = window.confirm('End this session without saving?')
        pauseHeartbeatRef.current = false
        if (!confirmed) return
      }
      onBack()
    } else {
      onBack()
    }
  }

  // --- Complete ---
  const handleComplete = () => {
    if (confidenceLevel == null) return
    const rawScore = SCORE_MAP[confidenceLevel - 1]
    const durationSeconds = elapsedSeconds > 10800 ? undefined : elapsedSeconds
    logSession(topic.id, rawScore, new Date(), durationSeconds, source)
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

  const rawScore = confidenceLevel != null ? SCORE_MAP[confidenceLevel - 1] : 50

  return (
    <div className="px-4 pt-6 min-h-screen bg-gray-50">
      {/* Back button — visible in pre and active */}
      {phase !== 'post' && (
        <button
          onClick={handleBack}
          className="text-sm text-gray-500 mb-6 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Topic header — all phases */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: subject.color }} />
        <div>
          <h2 className="text-xl font-bold text-gray-900">{topic.name}</h2>
          <p className="text-sm text-gray-500">{subject.name}</p>
        </div>
      </div>

      {/* Discard banner */}
      {discardBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-amber-700">
            Timer stopped — you left the app mid-session.
          </p>
          <button
            onClick={() => setDiscardBanner(false)}
            className="text-amber-400 hover:text-amber-600 ml-3 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Phase: pre — Start button */}
      {phase === 'pre' && (
        <div className="text-center mt-12">
          <button
            onClick={() => {
              setDiscardBanner(false)
              setPhase('active')
            }}
            className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            Start Studying
          </button>
        </div>
      )}

      {/* Phase: active — Clock + Timer + Stop */}
      {phase === 'active' && (
        <div className="text-center mt-8">
          {/* Analog clock animation */}
          <div className="flex justify-center mb-4">
            <div className="study-clock">
              <div className="study-clock__face">
                <div className="study-clock__marks">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className="study-clock__mark" style={{ transform: `rotate(${i * 30}deg)` }} />
                  ))}
                </div>
                <div className="study-clock__hands">
                  <div className="study-clock__hand study-clock__hand--hour" />
                  <div className="study-clock__hand study-clock__hand--min" />
                  <div className="study-clock__hand study-clock__hand--sec" />
                  <div className="study-clock__dot" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-5xl font-mono font-bold text-gray-900 tabular-nums tracking-tight mb-1">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-8 animate-pulse">Session in progress</p>
          <button
            onClick={() => setPhase('post')}
            className="w-full py-4 bg-red-500 text-white text-lg font-semibold rounded-xl transition-colors hover:bg-red-600 active:bg-red-700"
          >
            Stop Studying
          </button>
        </div>
      )}

      {/* Phase: post, not submitted — Emoji picker + Complete */}
      {phase === 'post' && !submitted && (
        <div>
          <p className="text-center text-sm text-gray-500 mb-6">
            Session: {formatTime(elapsedSeconds)}
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-3">
            How did it go?
          </label>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-center gap-4">
              {EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setConfidenceLevel(i + 1)}
                  className={`text-3xl transition-all ${
                    confidenceLevel === i + 1
                      ? 'scale-125 drop-shadow-sm'
                      : confidenceLevel != null
                        ? 'opacity-40 grayscale'
                        : ''
                  }`}
                  aria-label={`Confidence ${i + 1} of 5`}
                >
                  {emoji}
                </button>
              ))}
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
            onClick={handleComplete}
            disabled={confidenceLevel == null}
            className="w-full mt-6 py-3.5 bg-blue-600 text-white font-medium rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Complete
          </button>
        </div>
      )}

      {/* Phase: post, submitted — Encouragement + results */}
      {phase === 'post' && submitted && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-3">
            {getEncouragement(rawScore)}
          </p>

          <div className="flex items-center justify-center gap-2 text-sm mb-3">
            <ConfidenceDots value={confidenceBefore} color={subject.color} />
            <span className="text-gray-400">{'\u2192'}</span>
            <ConfidenceDots value={confidenceAfter} color={subject.color} />
          </div>

          <p className="text-sm text-gray-500 mb-4">
            {getNextStep(rawScore)}
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
