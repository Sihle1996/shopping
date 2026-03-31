import api from './api'
import type { SubscriptionPlanDto, CreatePlanDto, UpdatePlanDto } from '../types'

export const subscriptionsService = {
  async getPlans(): Promise<SubscriptionPlanDto[]> {
    const { data } = await api.get<SubscriptionPlanDto[]>('/subscriptions/plans')
    return data
  },

  async createPlan(body: CreatePlanDto): Promise<SubscriptionPlanDto> {
    const { data } = await api.post<SubscriptionPlanDto>('/subscriptions/plans', body)
    return data
  },

  async updatePlan(id: string, body: UpdatePlanDto): Promise<SubscriptionPlanDto> {
    const { data } = await api.put<SubscriptionPlanDto>(`/subscriptions/plans/${id}`, body)
    return data
  },

  async deletePlan(id: string): Promise<void> {
    await api.delete(`/subscriptions/plans/${id}`)
  },

  async assignPlan(tenantId: string, planName: string): Promise<void> {
    await api.patch(`/subscriptions/stores/${tenantId}/assign-plan`, { planName })
  }
}
