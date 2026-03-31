import type { TopicTableStatus } from './analytics'

export function formatDuration(seconds: number): string {
  if (seconds < 60) return '<1m'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function confidenceEmojis(confidence: number): Array<{ emoji: string; active: boolean }> {
  const emojis = ['😟', '😕', '🙂', '😊', '🤩']
  return emojis.map((emoji, index) => ({ emoji, active: index === confidence - 1 }))
}

export function statusTone(status: TopicTableStatus | string): string {
  switch (status) {
    case 'Complete':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'Revision Ready':
      return 'bg-blue-50 text-blue-700 ring-blue-200'
    case 'Priority Now':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'Needs Focus':
      return 'bg-orange-50 text-orange-700 ring-orange-200'
    case 'Not Started':
      return 'border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,247,252,0.9))] text-slate-500 ring-slate-200/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur'
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200'
  }
}
