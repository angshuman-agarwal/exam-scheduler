import { httpTutoringApi } from '../http/tutoring'
import type { TutoringApi } from '../types'

export function useTutoringApi(): TutoringApi {
  return httpTutoringApi
}
