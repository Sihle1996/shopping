import api from './api'

export interface SupportMsg {
  senderRole: string
  senderEmail: string | null
  body: string
  createdAt: string
}

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
  messages: SupportMsg[]
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
  messages: SupportMsg[]
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
  async sendMessage(id: string, body: string, resolve: boolean): Promise<void> {
    await api.post(`/support/${id}/message`, { body, resolve })
  }
}
