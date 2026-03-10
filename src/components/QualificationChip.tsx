export default function QualificationChip({ mode }: { mode: 'gcse' | 'alevel' }) {
  return (
    <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
      {mode === 'gcse' ? 'GCSE' : 'A-Level'}
    </span>
  )
}
