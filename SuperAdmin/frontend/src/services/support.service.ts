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
  platformNote: string | null
  platformReviewedAt: string | null
}

export interface PlatformTicket {
  id: string
  storeId: string | null
  store: string | null
  requester: string | null
  subject: string
  message: string
  status: string
  platformNote: string | null
  platformReviewedAt: string | null
  createdAt: string
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
  async getPlatform(): Promise<PlatformTicket[]> {
    const { data } = await api.get<PlatformTicket[]>('/support/platform')
    return data
  },
  async getStoreSignals(): Promise<StoreSignal[]> {
    const { data } = await api.get<StoreSignal[]>('/support/store-signals')
    return data
  },
  async addNote(id: string, note: string, resolve: boolean): Promise<void> {
    await api.post(`/support/${id}/platform-note`, { note, resolve })
  }
}
