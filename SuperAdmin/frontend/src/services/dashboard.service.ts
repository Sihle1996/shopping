import api from './api'
import type { StatsDto } from '../types'

export const dashboardService = {
  async getStats(): Promise<StatsDto> {
    const { data } = await api.get<StatsDto>('/dashboard/stats')
    return data
  }
}
