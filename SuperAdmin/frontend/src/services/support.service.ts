import api from './api'

export interface EscalatedTicket {
  id: string
  storeId: string | null
  store: string | null
  customer: string | null
  subject: string
  message: string
  status: string
  adminNotes: string | null
  escalationReason: string | null
  createdAt: string
  escalatedAt: string | null
  resolvedAt: string | null
}

export interface StoreSignal {
  storeId: string | null
  store: string | null
  total: number
  open: number
  escalated: number
}

export const supportService = {
  async getEscalated(): Promise<EscalatedTicket[]> {
    const { data } = await api.get<EscalatedTicket[]>('/support/escalated')
    return data
  },
  async getStoreSignals(): Promise<StoreSignal[]> {
    const { data } = await api.get<StoreSignal[]>('/support/store-signals')
    return data
  }
}
