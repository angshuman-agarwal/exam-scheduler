import type { SubjectsApi, NearestExamSummary, SelectedSubjectSummary } from '../types'

export const localSubjectsApi: SubjectsApi = {
  getNearestExamSummary({ papers, offerings, subjects, boards, selectedOfferingIds, today }) {
    const selectedIds = new Set(selectedOfferingIds)
    let nearest: NearestExamSummary | null = null
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    for (const paper of papers) {
      if (!selectedIds.has(paper.offeringId)) continue

      const exam = new Date(paper.examDate + 'T00:00:00')
      const diff = Math.ceil((exam.getTime() - localToday.getTime()) / 86_400_000)
      if (diff <= 0) continue

      if (nearest && diff >= nearest.days) continue

      const offering = offerings.find((entry) => entry.id === paper.offeringId)
      const subject = offering ? subjects.find((entry) => entry.id === offering.subjectId) : null
      const board = offering ? boards.find((entry) => entry.id === offering.boardId) : null

      nearest = {
        days: diff,
        subjectName: subject?.name ?? '',
        paperName: paper.name,
        board: board?.name ?? '',
      }
    }

    return nearest
  },

  getSelectedSubjectSummaries({ offerings, subjects, boards, selectedOfferingIds }) {
    const seen = new Set<string>()
    const result: SelectedSubjectSummary[] = []

    for (const offeringId of selectedOfferingIds) {
      const offering = offerings.find((entry) => entry.id === offeringId)
      if (!offering) continue

      const key = `${offering.subjectId}|${offering.boardId}`
      if (seen.has(key)) continue
      seen.add(key)

      const subject = subjects.find((entry) => entry.id === offering.subjectId)
      const board = boards.find((entry) => entry.id === offering.boardId)
      if (!subject || !board) continue

      result.push({ name: subject.name, board: board.name })
    }

    result.sort((left, right) => left.name.localeCompare(right.name))
    return result
  },
}
