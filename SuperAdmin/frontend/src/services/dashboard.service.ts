import api from './api'
import type { StatsDto } from '../types'

export const dashboardService = {
  async getStats(): Promise<StatsDto> {
    const { data } = await api.get<StatsDto>('/dashboard/stats')
    return data
  },
  async getOrdersByStatus(): Promise<{ status: string; count: number }[]> {
    const { data } = await api.get('/dashboard/orders-by-status')
    return data
  },
  async getOrdersOverTime(days = 30): Promise<{ date: string; count: number; revenue: number }[]> {
    const { data } = await api.get('/dashboard/orders-over-time', { params: { days } })
    return data
  },
  async getTopStores(): Promise<{ name: string; orders: number; revenue: number }[]> {
    const { data } = await api.get('/dashboard/top-stores')
    return data
  },
  async getStoresByPlan(): Promise<{ plan: string; count: number }[]> {
    const { data } = await api.get('/dashboard/stores-by-plan')
    return data
  }
}
