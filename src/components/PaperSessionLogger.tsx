import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useAppStore } from '../stores/app.store'
import { useTimerStore } from '../stores/timer.store'
import { useLocalAccountApi } from '../lib/api/local/useAccountApi'
import { useWakeLock } from '../lib/useWakeLock'
import { getLocalDayKey } from '../lib/date'
import QualificationChip from './QualificationChip'
import FullPaperPracticeCard from './FullPaperPracticeCard'
import { PAPER_STRICT_THRESHOLD_MS } from '../lib/timer'
import type { Offering, Paper, PaperAttemptSource, Subject } from '../types'

interface PaperSessionLoggerProps {
  paper: Paper
  offering: Offering
  subject: Subject
  source: PaperAttemptSource
  selectionRequired?: boolean
  restored?: boolean
  onBack: () => void
  onGoToProgress: () => void
  onBrowseTopics: (paper: Paper) => void
}

const CONFIDENCE_EMOJI = ['\u{1F630}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F929}'] as const

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatShortExamDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function ConfirmSheet({
  title,
  body,
  onConfirm,
  onCancel,
  confirmLabel,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{body}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  )
}

function SettingsToggleRow({
  icon,
  title,
  helper,
  checked,
  onChange,
  disabled,
  accentBg,
  accentBorder,
  accentTrack,
  accentChipBg,
  accentChipText,
}: {
  icon: React.ReactNode
  title: string
  helper: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  accentBg: string
  accentBorder: string
  accentTrack: string
  accentChipBg: string
  accentChipText: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50 active:bg-gray-100',
        checked && !disabled ? `${accentBg} ${accentBorder} border` : 'border border-transparent',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
          checked && !disabled ? `${accentChipBg} ${accentChipText}` : 'bg-gray-100 text-gray-400',
        ].join(' ')}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-gray-800">{title}</p>
        <p className="mt-0.5 text-xs leading-tight text-gray-400">{helper}</p>
      </div>
      <div
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          disabled ? 'bg-gray-200' : checked ? accentTrack : 'bg-gray-300',
        ].join(' ')}
      >
        <div
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </div>
    </button>
  )
}

export default function PaperSessionLogger({
  paper,
  offering,
  subject,
  source,
  selectionRequired = false,
  restored = false,
  onBack,
  onGoToProgress,
  onBrowseTopics,
}: PaperSessionLoggerProps) {
  const posthog = usePostHog()
  const { studyMode } = useLocalAccountApi()
  const logPaperAttempt = useAppStore((state) => state.logPaperAttempt)
  const topics = useAppStore((state) => state.topics)
  const papers = useAppStore((state) => state.papers)
  const offeringPapers = useMemo(
    () => papers
      .filter((candidate) => candidate.offeringId === offering.id)
      .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [offering.id, papers],
  )
  const requiresSelection = selectionRequired && offeringPapers.length > 1
  const todayKey = getLocalDayKey(new Date())
  const defaultPaperId = useMemo(() => {
    const upcomingPaper = offeringPapers.find((candidate) => candidate.examDate >= todayKey)
    return upcomingPaper?.id ?? offeringPapers[0]?.id ?? paper.id
  }, [offeringPapers, paper.id, todayKey])
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(() => (requiresSelection ? defaultPaperId : paper.id))

  const session = useTimerStore((state) => state.session)
  const settings = useTimerStore((state) => state.settings)
  const banner = useTimerStore((state) => state.banner)
  const start = useTimerStore((state) => state.start)
  const pause = useTimerStore((state) => state.pause)
  const resume = useTimerStore((state) => state.resume)
  const stop = useTimerStore((state) => state.stop)
  const discard = useTimerStore((state) => state.discard)
  const discardPersisted = useTimerStore((state) => state.discardPersisted)
  const onHidden = useTimerStore((state) => state.onHidden)
  const onVisible = useTimerStore((state) => state.onVisible)
  const dismissBanner = useTimerStore((state) => state.dismissBanner)
  const getElapsedMs = useTimerStore((state) => state.getElapsedMs)
  const updateSettings = useTimerStore((state) => state.updateSettings)

  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [rawMark, setRawMark] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [noteText, setNoteText] = useState('')
  const [taggedTopicIds, setTaggedTopicIds] = useState<string[]>([])
  const [topicsExpanded, setTopicsExpanded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'stop' | 'discard' | null>(null)

  const mode = session?.mode ?? null
  const phase = submitted
    ? 'submitted'
    : !session
    ? 'pre'
    : mode === 'running' || mode === 'paused'
      ? 'active'
      : mode === 'stopped'
      ? 'post-review'
        : 'post-interrupted'
  const selectedPaper = useMemo(() => {
    // Only the pre-start chooser is allowed to derive a different paper within the same offering.
    // Once a session exists, the UI must stay pinned to the actual session paper and never silently retarget.
    if (phase !== 'pre') {
      // Use the paper the user actually started (session.targetId), not the original prop which always defaults to Paper 1.
      return offeringPapers.find((candidate) => candidate.id === session?.targetId) ?? paper
    }
    return offeringPapers.find((candidate) => candidate.id === (selectedPaperId ?? defaultPaperId ?? paper.id)) ?? paper
  }, [defaultPaperId, offeringPapers, paper, phase, selectedPaperId, session?.targetId])
  const paperTopics = useMemo(
    () => topics.filter((topic) => topic.paperId === selectedPaper.id),
    [selectedPaper.id, topics],
  )

  const wakeLockEnabled = mode === 'running'
  const { active: wakeLockActive } = useWakeLock(wakeLockEnabled)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode === 'running') {
      const immediate = setTimeout(() => setDisplaySeconds(Math.floor(getElapsedMs() / 1000)), 0)
      const id = setInterval(() => setDisplaySeconds(Math.floor(getElapsedMs() / 1000)), 200)
      return () => { clearTimeout(immediate); clearInterval(id) }
    }
    if (mode === 'paused' || mode === 'stopped') {
      const immediate = setTimeout(() => setDisplaySeconds(Math.floor(getElapsedMs() / 1000)), 0)
      return () => clearTimeout(immediate)
    }
  }, [getElapsedMs, mode])

  useEffect(() => {
    if (phase !== 'active') return
    const handleVisChange = () => {
      if (document.hidden) onHidden()
      else onVisible()
    }
    const handlePageHide = () => onHidden()
    document.addEventListener('visibilitychange', handleVisChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [onHidden, onVisible, phase])

  useEffect(() => {
    if (banner === 'restored') {
      bannerTimerRef.current = setTimeout(dismissBanner, 3000)
      return () => {
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      }
    }
  }, [banner, dismissBanner])

  const handleBack = useCallback(() => {
    if (mode === 'running' || mode === 'paused') {
      setConfirmAction('discard')
      return
    }
    if (session) discard()
    onBack()
  }, [discard, mode, onBack, session])

  const computedPercent = useMemo(() => {
    const raw = Number(rawMark)
    const total = Number(totalMarks)
    if (!Number.isFinite(raw) || !Number.isFinite(total) || total <= 0) return null
    return Math.round((raw / total) * 100)
  }, [rawMark, totalMarks])

  const handleComplete = async () => {
    if (confidence == null) return
    const durationSeconds = Math.floor(getElapsedMs() / 1000)
    posthog?.capture('paper_complete', {
      subject: subject.name,
      paper: selectedPaper.name,
      confidence,
      duration_seconds: durationSeconds,
    })
    logPaperAttempt(
      selectedPaper.id,
      new Date(),
      durationSeconds,
      confidence,
      taggedTopicIds,
      source,
      rawMark.trim() ? Number(rawMark) : undefined,
      totalMarks.trim() ? Number(totalMarks) : undefined,
      noteText.trim() || undefined,
    )
    await discardPersisted()
    setSubmitted(true)
  }

  const confirmTitle = confirmAction === 'stop' ? 'End paper?' : 'Discard paper session?'
  const confirmBody = confirmAction === 'stop'
    ? 'You can review the paper score and notes next.'
    : 'This paper attempt will not be counted.'
  const selectionLocked = phase !== 'pre'
  const actionsDisabled = requiresSelection && selectedPaperId == null
  const headerPaper = selectedPaper
  const cardDescription = `Start a timed attempt for ${selectedPaper.name} and review the score afterwards.`
  const selectedTopicCount = taggedTopicIds.length

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6">
      {phase !== 'post-review' && phase !== 'post-interrupted' && phase !== 'submitted' && (
        <button onClick={handleBack} className="mb-6 flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      <div className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${phase === 'post-review' && restored ? 'mb-3.5' : 'mb-6'}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {subject.name}{headerPaper ? ` — ${headerPaper.name}` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
              {studyMode && <QualificationChip mode={studyMode} />}
              {studyMode && <span>&middot;</span>}
              <span>{offering.label}</span>
              {headerPaper && (
                <>
                  <span>&middot;</span>
                  <span>{headerPaper.examDate}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {phase === 'active' && banner === 'paused-away' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Paused while you were away
        </div>
      )}
      {phase === 'active' && banner === 'interrupted' && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Paper session interrupted - you were away too long.
        </div>
      )}

      {phase === 'pre' && offeringPapers.length > 1 && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Choose paper</p>
              <p className="mt-1 text-sm text-gray-500">
                You can switch papers here before starting or browsing topics.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {offeringPapers.map((candidate) => {
              const selected = selectedPaper.id === candidate.id
              return (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={selectionLocked}
                  onClick={() => setSelectedPaperId(candidate.id)}
                  className={[
                    'min-w-[6.75rem] rounded-[1.15rem] border px-3.5 py-2.5 text-left transition-all duration-150',
                    selectionLocked ? 'cursor-default opacity-70' : 'hover:border-blue-200 hover:bg-blue-50/70 hover:shadow-[0_10px_20px_rgba(37,95,216,0.08)]',
                    selected
                      ? 'border-blue-200 bg-[linear-gradient(180deg,rgba(244,249,255,1),rgba(232,242,255,0.96))] text-blue-700 shadow-[0_10px_22px_rgba(37,95,216,0.12)]'
                      : 'border-gray-200 bg-white text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
                  ].join(' ')}
                  aria-pressed={selected}
                >
                  <span className="block text-[0.95rem] font-semibold leading-tight">{candidate.name}</span>
                  <span className={`mt-1 block text-[11px] font-medium ${selected ? 'text-blue-600/80' : 'text-gray-400'}`}>
                    {formatShortExamDate(candidate.examDate)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === 'pre' && (
        <div>
          <FullPaperPracticeCard
            paper={selectedPaper}
            onStart={() => start('paper', selectedPaper.id, source)}
            disabled={actionsDisabled}
            description={cardDescription}
          />
          <button
            onClick={() => {
              onBrowseTopics(selectedPaper)
            }}
            className={[
              'mt-3 w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition-all duration-150',
              'border-blue-100 bg-[linear-gradient(180deg,rgba(247,250,255,1),rgba(239,246,255,0.92))] text-blue-900 hover:border-blue-200 hover:shadow-[0_12px_26px_rgba(37,95,216,0.12)]',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Browse topics instead</p>
                <p className="mt-1 text-xs text-blue-600/80">
                  Open {selectedPaper.name} topics and revise before attempting the full paper.
                </p>
              </div>
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                  'border-blue-200 bg-white/90 text-blue-600',
                ].join(' ')}
                aria-hidden="true"
              >
                <ArrowRightIcon className="h-4 w-4" />
              </div>
            </div>
          </button>

          <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Session preferences</p>
            <div className="space-y-1">
              <SettingsToggleRow
                icon={<ShieldIcon className="h-4 w-4" />}
                title="Strict mode"
                helper={`Interrupts the session if you leave for more than ${PAPER_STRICT_THRESHOLD_MS / 1000} seconds`}
                checked={settings.strictModeDefault}
                onChange={(value) => updateSettings({ strictModeDefault: value })}
                accentBg="bg-amber-50/80"
                accentBorder="border-amber-200/60"
                accentTrack="bg-amber-500"
                accentChipBg="bg-amber-100"
                accentChipText="text-amber-600"
              />
            </div>
          </div>
        </div>
      )}

      {phase === 'active' && mode === 'running' && (
        <div className="text-center mt-8">
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
          <p className="text-sm text-blue-500 font-medium mt-1 mb-4">Full paper in progress</p>

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
            Finish paper
          </button>
          <button
            onClick={pause}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors hover:bg-gray-200"
          >
            Pause
          </button>
        </div>
      )}

      {phase === 'active' && mode === 'paused' && (
        <div className="text-center mt-8">
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
            Finish paper
          </button>
        </div>
      )}

      {phase === 'post-review' && !submitted && (
        <div className="space-y-3.5">
          {restored && (
            <section className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(180deg,#fffaf0_0%,#fff4dc_100%)] px-4 py-2 shadow-[0_10px_24px_rgba(245,158,11,0.08)]">
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-semibold leading-[1.15] text-amber-950">Unfinished paper review restored</p>
                <p className="text-[13px] leading-[1.15] text-amber-800">Complete review to save this attempt.</p>
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">What did you score?</h3>
            <div className="mt-2.5 space-y-2.5">
              <label className="text-sm text-gray-600">
                Raw mark
                <input
                  value={rawMark}
                  onChange={(event) => setRawMark(event.target.value.replace(/[^\d]/g, ''))}
                  className="ios-input mt-1 w-full px-3 py-2"
                  inputMode="numeric"
                />
              </label>
              <label className="text-sm text-gray-600">
                Total marks
                <input
                  value={totalMarks}
                  onChange={(event) => setTotalMarks(event.target.value.replace(/[^\d]/g, ''))}
                  className="ios-input mt-1 w-full px-3 py-2"
                  inputMode="numeric"
                />
              </label>
            </div>
            <p className="mt-2.5 text-sm text-gray-500">
              {computedPercent == null ? 'Enter both marks to calculate the percent.' : `Estimated score: ${computedPercent}%`}
            </p>

            <div className="mt-3 border-t border-gray-100 pt-3">
              <h3 className="text-[15px] font-semibold leading-tight text-gray-900">How did that paper feel?</h3>
              <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                {CONFIDENCE_EMOJI.map((emoji, index) => {
                  const value = index + 1
                  const selected = confidence === value
                  return (
                    <button
                      key={value}
                      onClick={() => setConfidence(value)}
                      className={`rounded-xl border px-2 py-2.5 text-xl ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                    >
                      {emoji}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Notes</h3>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              className="ios-textarea mt-2.5 min-h-24 w-full px-3 py-2"
              placeholder="Optional notes about timing, mistakes, or what to revisit."
            />
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Which topics need work?</h3>
                <p className="mt-1 text-sm text-gray-500">Optional. Leave this blank if you just want to save the paper attempt.</p>
              </div>
              {selectedTopicCount > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  {selectedTopicCount} selected
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTopicsExpanded((current) => !current)}
              className="mt-2.5 inline-flex w-full items-center justify-between gap-3 rounded-full border border-gray-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-2.5 text-left text-gray-600 shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-[1px] hover:border-gray-300 hover:text-gray-700 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
              aria-expanded={topicsExpanded}
              aria-controls="paper-review-topics"
            >
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold text-gray-700">
                  {selectedTopicCount > 0 ? `${selectedTopicCount} flagged` : `${paperTopics.length} topics`}
                </span>
                <span className="text-[10px] text-gray-400">
                  Revisit topics
                </span>
              </span>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${topicsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {topicsExpanded && (
              <div id="paper-review-topics" className="mt-2.5 flex flex-wrap gap-2 border-t border-gray-100 pt-2.5">
                {paperTopics.map((topic) => {
                  const selected = taggedTopicIds.includes(topic.id)
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setTaggedTopicIds((current) => selected ? current.filter((id) => id !== topic.id) : [...current, topic.id])}
                      className={`rounded-full border px-3 py-1.5 text-sm ${selected ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700'}`}
                    >
                      {topic.name}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <button
            onClick={handleComplete}
            disabled={confidence == null}
            className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Complete
          </button>
        </div>
      )}

      {phase === 'submitted' && (
        <div className="mt-6 rounded-[1.75rem] border border-emerald-100/80 bg-[linear-gradient(180deg,#ffffff_0%,#f9fffb_100%)] p-6 text-center shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Paper saved</h3>
          <p className="mt-2 text-sm text-gray-500">Your paper attempt has been logged and is ready to show in progress.</p>
          <div className="mt-6 space-y-3">
            <button onClick={onGoToProgress} className="w-full rounded-xl bg-blue-600 py-3 text-white">View progress</button>
            <button onClick={onBack} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-gray-700">Back to plan</button>
          </div>
        </div>
      )}

      {phase === 'post-interrupted' && (
        <div className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900">Session interrupted</h3>
          <p className="mt-2 text-sm text-gray-500">This paper attempt was not counted.</p>
          <button onClick={() => { discard(); onBack() }} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-white">
            Back to plan
          </button>
        </div>
      )}

      {confirmAction && (
        <ConfirmSheet
          title={confirmTitle}
          body={confirmBody}
          confirmLabel={confirmAction === 'stop' ? 'End paper' : 'Discard'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction === 'stop') stop()
            else {
              posthog?.capture('paper_cancel', { subject: subject.name, paper: selectedPaper.name })
              discard()
              onBack()
            }
            setConfirmAction(null)
          }}
        />
      )}
    </div>
  )
}
