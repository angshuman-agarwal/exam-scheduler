import { getLocalDayKey } from '../../date'
import type { PlansApi } from '../types'

export const localPlansApi: PlansApi = {
  getPlanItems({ dailyPlan, planDay, today }) {
    return planDay === getLocalDayKey(today) ? dailyPlan : []
  },
}
