import { useAppStore } from '../../../stores/app.store'
import type { ScheduleSource } from '../../../types'
import { localPlansApi } from './plans'

export function useLocalPlansApi() {
  const dailyPlan = useAppStore((state) => state.dailyPlan)
  const planDay = useAppStore((state) => state.planDay)
  const getPlanItems = useAppStore((state) => state.getPlanItems)
  const addToPlan = useAppStore((state) => state.addToPlan)
  const removeFromPlan = useAppStore((state) => state.removeFromPlan)
  const clearPlan = useAppStore((state) => state.clearPlan)
  const autoFillPlan = useAppStore((state) => state.autoFillPlan)

  return {
    getPlanItems(today: Date) {
      const derivedPlanItems = localPlansApi.getPlanItems({ dailyPlan, planDay, today })
      return derivedPlanItems.length > 0 ? derivedPlanItems : getPlanItems(today)
    },
    addToPlan(topicId: string, source: ScheduleSource, today: Date) {
      addToPlan(topicId, source, today)
    },
    removeFromPlan(id: string) {
      removeFromPlan(id)
    },
    clearPlan() {
      clearPlan()
    },
    autoFillPlan(today: Date) {
      autoFillPlan(today)
    },
  }
}
