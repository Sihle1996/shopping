import api from './api'
import type { PendingEnrollmentDto } from '../types'

export const enrollmentService = {
  async getPending(): Promise<PendingEnrollmentDto[]> {
    const { data } = await api.get<PendingEnrollmentDto[]>('/enrollment/pending')
    return data
  },

  async approve(tenantId: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/approve`)
  },

  async reject(tenantId: string, reason: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/reject`, { reason })
  }
}
