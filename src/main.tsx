import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithPWA from './AppWithPWA.tsx'

// ── E2E test bridge (compiled out of normal builds) ──
// Only present when built with PLAYWRIGHT_E2E=1. Tree-shaken otherwise.
declare const __E2E_BRIDGE__: boolean

if (__E2E_BRIDGE__) {
  import('./stores/app.store').then(({ useAppStore }) => {
    const bridge = {
      addNote(topicId: string, text: string) {
        useAppStore.getState().addNote(topicId, text)
      },
      logSession(topicId: string, rawScore: number) {
        useAppStore.getState().logSession(topicId, rawScore, new Date())
      },
      removeNoteById(noteId: string) {
        useAppStore.getState().removeNoteById(noteId)
      },
      updateNoteById(noteId: string, text: string) {
        useAppStore.getState().updateNoteById(noteId, text)
      },
      addToPlan(topicId: string, source: string) {
        useAppStore.getState().addToPlan(topicId, source as 'manual' | 'auto', new Date())
      },
      confirmTierSelection(subjectId: string, offeringId: string) {
        useAppStore.getState().confirmTierSelection(subjectId, offeringId)
      },
      switchTierSelection(subjectId: string, fromOfferingId: string, toOfferingId: string) {
        useAppStore.getState().switchTierSelection(subjectId, fromOfferingId, toOfferingId)
      },
      readState() {
        const s = useAppStore.getState()
        return {
          notes: s.notes,
          sessions: s.sessions,
          topics: s.topics,
          dailyPlan: s.dailyPlan,
          selectedOfferingIds: s.selectedOfferingIds,
          pendingTierConfirmations: Array.from(s.pendingTierConfirmations),
        }
      },
    }
    ;(window as unknown as Record<string, unknown>).__E2E__ = bridge
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithPWA />
  </StrictMode>,
)
