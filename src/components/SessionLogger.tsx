import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../stores/app.store'
import { useTimerStore } from '../stores/timer.store'
import { useLocalAccountApi } from '../lib/api/local/useAccountApi'
import { useLocalPlansApi } from '../lib/api/local/usePlansApi'
import { useWakeLock } from '../lib/useWakeLock'
import QualificationChip from './QualificationChip'
import type { ScoredTopic, ScheduleSource } from '../types'

interface SessionLoggerProps {
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
  onBack: () => void
  onGoToProgress: () => void
}

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

const CONFIDENCE_EMOJI = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60E}'] as const

// --- Icons (inline SVG) ---

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

// --- Settings Toggle Row ---

interface SettingsToggleRowProps {
  icon: React.ReactNode
  title: string
  helper: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  accentBg: string      // e.g. "bg-amber-50"
  accentBorder: string   // e.g. "border-amber-200"
  accentTrack: string    // e.g. "bg-amber-500"
  accentChipBg: string   // e.g. "bg-amber-100"
  accentChipText: string // e.g. "text-amber-600"
}

function SettingsToggleRow({
  icon, title, helper, checked, onChange, disabled,
  accentBg, accentBorder, accentTrack, accentChipBg, accentChipText,
}: SettingsToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left transition-all duration-150',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-gray-50 active:bg-gray-100',
        checked && !disabled ? `${accentBg} ${accentBorder} border` : 'border border-transparent',
      ].join(' ')}
    >
      {/* Icon chip */}
      <div className={[
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150',
        checked && !disabled ? `${accentChipBg} ${accentChipText}` : 'bg-gray-100 text-gray-400',
      ].join(' ')}>
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{title}</p>
        <p className="text-xs text-gray-400 leading-tight mt-0.5">{helper}</p>
      </div>

      {/* Custom switch */}
      <div className={[
        'relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200',
        disabled ? 'bg-gray-200' : checked ? accentTrack : 'bg-gray-300',
      ].join(' ')}>
        <div className={[
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5.5' : 'translate-x-0.5',
        ].join(' ')} />
      </div>
    </button>
  )
}

// --- Confirm Sheet (bottom sheet on mobile, centered modal on desktop) ---

interface ConfirmSheetProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmSheet({ title, body, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: ConfirmSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus the cancel button on mount
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  // Focus trap within sheet
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = sheet.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      {/* Sheet */}
      <div ref={sheetRef} className="relative w-full sm:max-w-sm mx-auto bg-white rounded-t-2xl sm:rounded-2xl p-6 pb-8 sm:pb-6 shadow-xl animate-[slideUp_200ms_ease-out] sm:animate-[fadeScale_150ms_ease-out]">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{body}</p>
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200 active:bg-gray-300"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 text-white font-medium rounded-xl transition-colors ${destructive ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfidenceDots({ value }: { value: number }) {
  return (
    <span className="text-sm leading-none" title={`Confidence: ${value}/5`}>
      {CONFIDENCE_EMOJI[Math.max(0, Math.min(4, value - 1))] ?? '\u{1F610}'}
    </span>
  )
}

export default function SessionLogger({ scored, source, scheduleItemId, onBack, onGoToProgress }: SessionLoggerProps) {
  const { topic, subject, offering } = scored
  const logSession = useAppStore((s) => s.logSession)
  const addNote = useAppStore((s) => s.addNote)
  const { studyMode } = useLocalAccountApi()
  const plansApi = useLocalPlansApi()

  const session = useTimerStore((s) => s.session)
  const settings = useTimerStore((s) => s.settings)
  const banner = useTimerStore((s) => s.banner)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const stop = useTimerStore((s) => s.stop)
  const discard = useTimerStore((s) => s.discard)
  const onHidden = useTimerStore((s) => s.onHidden)
  const onVisible = useTimerStore((s) => s.onVisible)
  const dismissBanner = useTimerStore((s) => s.dismissBanner)
  const getElapsedMs = useTimerStore((s) => s.getElapsedMs)
  const updateSettings = useTimerStore((s) => s.updateSettings)

  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [confidenceLevel, setConfidenceLevel] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [confidenceBefore] = useState(topic.confidence)
  const [confirmAction, setConfirmAction] = useState<'stop' | 'discard' | null>(null)

  const mode = session?.mode ?? null

  // Wake lock: active only when running + enabled
  const wakeLockEnabled = mode === 'running' && settings.wakeLockEnabled
  const { supported: wakeLockSupported, active: wakeLockActive } = useWakeLock(wakeLockEnabled)

  // Phase mapping
  const phase = !session
    ? 'pre'
    : mode === 'running' || mode === 'paused'
      ? 'active'
      : mode === 'stopped'
        ? 'post-review'
        : 'post-interrupted'

  // Tick: update display timer
  useEffect(() => {
    if (mode === 'running') {
      // Use 0ms timeout to avoid synchronous setState in effect body
      const immediate = setTimeout(() => {
        setDisplaySeconds(Math.floor(getElapsedMs() / 1000))
      }, 0)
      const id = setInterval(() => {
        setDisplaySeconds(Math.floor(getElapsedMs() / 1000))
      }, 200)
      return () => { clearTimeout(immediate); clearInterval(id) }
    }
    if (mode === 'paused' || mode === 'stopped') {
      const immediate = setTimeout(() => {
        setDisplaySeconds(Math.floor(getElapsedMs() / 1000))
      }, 0)
      return () => clearTimeout(immediate)
    }
  }, [mode, getElapsedMs])

  // Visibility + pagehide listeners
  useEffect(() => {
    if (phase !== 'active') return
    const handleVisChange = () => {
      if (document.hidden) {
        onHidden()
      } else {
        onVisible()
      }
    }
    const handlePageHide = () => onHidden()
    document.addEventListener('visibilitychange', handleVisChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [phase, onHidden, onVisible])

  // Auto-dismiss restored banner after 3s
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (banner === 'restored') {
      bannerTimerRef.current = setTimeout(dismissBanner, 3000)
      return () => {
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      }
    }
  }, [banner, dismissBanner])

  // Back button (state-aware)
  const handleBack = useCallback(() => {
    if (mode === 'running' || mode === 'paused') {
      setConfirmAction('discard')
    } else {
      if (session) discard()
      onBack()
    }
  }, [mode, discard, onBack, session])

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'stop') {
      stop()
    } else if (confirmAction === 'discard') {
      discard()
      onBack()
    }
    setConfirmAction(null)
  }, [confirmAction, stop, discard, onBack])

  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null)
  }, [])

  // Complete
  const handleComplete = () => {
    if (confidenceLevel == null) return
    const rawScore = SCORE_MAP[confidenceLevel - 1]
    const durationSeconds = Math.floor(getElapsedMs() / 1000)
    const safeDuration = durationSeconds > 10800 ? undefined : durationSeconds
    logSession(topic.id, rawScore, new Date(), safeDuration, source)
    if (noteText.trim()) {
      addNote(topic.id, noteText.trim())
      setNoteText('')
    }
    if (scheduleItemId) {
      plansApi.removeFromPlan(scheduleItemId)
    }
    setSubmitted(true)
  }

  // Get updated confidence after submission
  const topics = useAppStore((s) => s.topics)
  const updatedTopic = submitted ? topics.find((t) => t.id === topic.id) : null
  const confidenceAfter = updatedTopic?.confidence ?? confidenceBefore

  function flushAndNavigate(navigate: () => void) {
    const trimmed = noteText.trim()
    if (trimmed) {
      addNote(topic.id, trimmed)
      setNoteText('')
    }
    discard()
    navigate()
  }

  const rawScore = confidenceLevel != null ? SCORE_MAP[confidenceLevel - 1] : 50

  return (
    <div className="px-4 pt-6 min-h-screen bg-gray-50">
      {/* Back button */}
      {phase !== 'post-review' && phase !== 'post-interrupted' && (
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

      {/* Topic header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: subject.color }} />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{topic.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
              {studyMode && <QualificationChip mode={studyMode} />}
              {studyMode && <span>&middot;</span>}
              <span>{subject.name}</span>
              <span>&middot;</span>
              <span>{offering.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banners — active phase only */}
      {phase === 'active' && banner === 'paused-away' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-amber-700">Paused while you were away</p>
          <button onClick={dismissBanner} className="text-amber-400 hover:text-amber-600 ml-3 shrink-0" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {phase === 'active' && banner === 'interrupted' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-700">Session interrupted — you were away too long (strict mode)</p>
        </div>
      )}

      {/* Restored toast — overlay, active phase only */}
      {phase === 'active' && banner === 'restored' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 shadow-lg">
          <p className="text-sm text-green-700">Session restored</p>
        </div>
      )}

      {/* Pre phase */}
      {phase === 'pre' && (
        <div>
          <div className="text-center mt-8">
            <button
              onClick={() => start(topic.id, source, scheduleItemId)}
              className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Start Studying
            </button>
          </div>

          {/* Session rules */}
          <div className="mt-4 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-2">Session preferences</p>
            <div className="space-y-1">
              <SettingsToggleRow
                icon={<ShieldIcon className="w-4 h-4" />}
                title="Strict mode"
                helper="Interrupts the session if you leave for more than 15 seconds"
                checked={settings.strictModeDefault}
                onChange={(v) => updateSettings({ strictModeDefault: v })}
                accentBg="bg-amber-50/80"
                accentBorder="border-amber-200/60"
                accentTrack="bg-amber-500"
                accentChipBg="bg-amber-100"
                accentChipText="text-amber-600"
              />
              <SettingsToggleRow
                icon={<SunIcon className="w-4 h-4" />}
                title="Keep screen awake"
                helper={wakeLockSupported
                  ? 'Keeps the display awake while the session is running'
                  : 'Not supported on this browser'}
                checked={settings.wakeLockEnabled}
                onChange={(v) => updateSettings({ wakeLockEnabled: v })}
                disabled={!wakeLockSupported}
                accentBg="bg-blue-50/80"
                accentBorder="border-blue-200/60"
                accentTrack="bg-blue-500"
                accentChipBg="bg-blue-100"
                accentChipText="text-blue-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active phase: running */}
      {phase === 'active' && mode === 'running' && (
        <div className="text-center mt-8">
          {/* Analog clock */}
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
            {formatTime(displaySeconds)}
          </p>
          <p className="text-sm text-blue-500 font-medium mt-1 mb-4">Session in progress</p>

          {/* Status badges */}
          <div className="flex justify-center gap-2 mb-6">
            {session?.strictMode && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                <ShieldIcon className="w-3 h-3" />
                Strict mode
              </span>
            )}
            {wakeLockActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                <SunIcon className="w-3 h-3" />
                Screen awake
              </span>
            )}
          </div>

          <button
            onClick={() => setConfirmAction('stop')}
            className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 mb-3"
          >
            Finish studying
          </button>
          <button
            onClick={pause}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200"
          >
            Pause
          </button>
        </div>
      )}

      {/* Active phase: paused */}
      {phase === 'active' && mode === 'paused' && (
        <div className="text-center mt-8">
          {/* Dimmed clock */}
          <div className="flex justify-center mb-4 opacity-40">
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

          <p className="text-5xl font-mono font-bold text-gray-400 tabular-nums tracking-tight mb-1">
            {formatTime(displaySeconds)}
          </p>
          <p className="text-sm text-amber-500 font-medium mt-1 mb-8">Paused</p>

          <button
            onClick={resume}
            className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 mb-3"
          >
            Resume
          </button>
          <button
            onClick={() => setConfirmAction('stop')}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200"
          >
            Finish studying
          </button>
        </div>
      )}

      {/* Post phase: review (stopped) */}
      {phase === 'post-review' && !submitted && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-center text-sm text-gray-400 mb-5">
            Session: {formatTime(displaySeconds)}
          </p>

          <p className="text-base font-semibold text-gray-900 mb-3 text-center">
            How did it go?
          </p>
          <div className="flex justify-center gap-4 mb-4">
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

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Any notes? (optional)"
            rows={2}
            className="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={handleComplete}
            disabled={confidenceLevel == null}
            className="w-full mt-4 py-3.5 bg-blue-600 text-white font-medium rounded-xl transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Complete
          </button>
        </div>
      )}

      {/* Post phase: review submitted */}
      {phase === 'post-review' && submitted && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center mt-1">
          <p className="text-lg font-semibold text-gray-900 mb-3">
            {getEncouragement(rawScore)}
          </p>

          <div className="flex items-center justify-center gap-2 text-sm mb-3">
            <ConfidenceDots value={confidenceBefore} />
            <span className="text-gray-400">{'\u2192'}</span>
            <ConfidenceDots value={confidenceAfter} />
          </div>

          <p className="text-sm text-gray-500 mb-4">
            {getNextStep(rawScore)}
          </p>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note? (optional)"
            rows={2}
            className="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <p className="text-xs text-gray-400 text-center mt-4 mb-3">Your progress has been updated</p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => flushAndNavigate(onBack)}
              className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 hover:bg-blue-700"
            >
              Back to plan
            </button>
            <button
              onClick={() => flushAndNavigate(onGoToProgress)}
              className="w-full bg-white text-gray-700 font-medium rounded-xl py-3 border border-gray-200 hover:bg-gray-50"
            >
              View progress
            </button>
          </div>
        </div>
      )}

      {/* Post phase: interrupted */}
      {phase === 'post-interrupted' && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="h-1 bg-red-400" />
          <div className="p-6 text-center">
            <div className="text-4xl mb-4">{'\u26A0\uFE0F'}</div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Session interrupted</p>
            <p className="text-sm text-gray-500 mb-6">
              You were away for too long while strict mode was on. This session won't be counted.
            </p>
            <button
              onClick={() => { discard(); onBack() }}
              className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200"
            >
              Back to Plan
            </button>
          </div>
        </div>
      )}

      {/* Confirm sheet */}
      {confirmAction && (
        <ConfirmSheet
          title={confirmAction === 'stop' ? 'End session?' : 'Discard session?'}
          body={
            confirmAction === 'stop'
              ? "You'll move to review and can still log how it went."
              : 'This session will be lost.'
          }
          confirmLabel={confirmAction === 'stop' ? 'End session' : 'Discard'}
          cancelLabel={confirmAction === 'stop' ? 'Keep studying' : 'Cancel'}
          destructive={confirmAction === 'discard'}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </div>
  )
}
