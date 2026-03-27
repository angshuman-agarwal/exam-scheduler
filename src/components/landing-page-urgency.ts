export function homeUrgencyTone(days: number) {
  if (days < 14) return { label: 'Final stretch' as const, bg: 'bg-orange-100', text: 'text-orange-700' }
  if (days < 30) return { label: 'Getting close' as const, bg: 'bg-amber-100', text: 'text-amber-700' }
  return { label: 'On track' as const, bg: 'bg-blue-50', text: 'text-blue-600' }
}
