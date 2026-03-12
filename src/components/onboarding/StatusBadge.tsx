export default function StatusBadge({ isSelected, chosenLabel }: { isSelected: boolean; chosenLabel: string | null }) {
  if (!isSelected) {
    return <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">Not taking</span>
  }
  if (!chosenLabel) {
    return <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Pick option</span>
  }
  return <span className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full font-medium">{chosenLabel}</span>
}
