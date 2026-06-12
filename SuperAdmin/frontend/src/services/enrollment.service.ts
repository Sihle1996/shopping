import api from './api'
import type { PendingEnrollmentDto, BankingChangeDto } from '../types'

export const enrollmentService = {
  async getPending(): Promise<PendingEnrollmentDto[]> {
    const { data } = await api.get<PendingEnrollmentDto[]>('/enrollment/pending')
    return data
  },

  async getRejected(): Promise<PendingEnrollmentDto[]> {
    const { data } = await api.get<PendingEnrollmentDto[]>('/enrollment/rejected')
    return data
  },

  async approve(tenantId: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/approve`)
  },

  async reject(tenantId: string, reason: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/reject`, { reason })
  },

  async archive(tenantId: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/archive`)
  },

  async reviewDocument(documentId: string, status: 'ACCEPTED' | 'REJECTED', notes?: string): Promise<void> {
    await api.post(`/enrollment/document/${documentId}/review`, { status, notes: notes ?? null })
  },

  async getBankingChanges(): Promise<BankingChangeDto[]> {
    const { data } = await api.get<BankingChangeDto[]>('/enrollment/banking-changes')
    return data
  },

  async approveBankingChange(tenantId: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/banking-change/approve`)
  },

  async rejectBankingChange(tenantId: string): Promise<void> {
    await api.post(`/enrollment/${tenantId}/banking-change/reject`)
  }
}
