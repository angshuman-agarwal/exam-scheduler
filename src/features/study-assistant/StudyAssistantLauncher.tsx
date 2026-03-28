import type { StudyAssistantMode } from './types'

interface StudyAssistantLauncherProps {
  isOpen: boolean
  onOpen: (mode?: StudyAssistantMode) => void
}

export default function StudyAssistantLauncher({
  isOpen,
  onOpen,
}: StudyAssistantLauncherProps) {
  return (
    <button
      type="button"
      data-testid="study-assistant-launcher"
      aria-label="Open study assistant"
      aria-expanded={isOpen}
      aria-controls="study-assistant-panel"
      onClick={() => onOpen()}
      className="fixed right-4 z-[60] flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border border-blue-100/80 bg-white/90 shadow-[0_18px_42px_rgba(34,78,196,0.14)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
    >
      <span className="pointer-events-none absolute inset-[-14px] rounded-full bg-[radial-gradient(circle,_rgba(124,116,255,0.18),_rgba(124,116,255,0)_62%)] opacity-70 blur-md motion-safe:animate-[pulse_6.2s_ease-in-out_infinite]" />
      <span className="pointer-events-none absolute inset-[-7px] rounded-full bg-[radial-gradient(circle,_rgba(93,170,255,0.18),_rgba(93,170,255,0)_66%)] opacity-80 blur-[4px] motion-safe:animate-[pulse_4.8s_ease-in-out_infinite]" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,_#f4fbff_0%,_#d6efff_18%,_#79b6ff_38%,_#5e72ff_68%,_#7463ff_100%)] text-white shadow-[0_14px_28px_rgba(75,106,255,0.24)]">
        <span className="text-[1.35rem] leading-none text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]">
          ✦
        </span>
        <span className="absolute -right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
      </span>
    </button>
  )
}
