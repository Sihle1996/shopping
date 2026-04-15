import api from './api'
import type { OrderDto, PaginatedResponse, OrderQueryParams } from '../types'

export const ordersService = {
  async getOrders(params: OrderQueryParams = {}): Promise<PaginatedResponse<OrderDto>> {
    const { data } = await api.get<PaginatedResponse<OrderDto>>('/orders', { params })
    return data
  },

  async updateStatus(id: string, status: string): Promise<void> {
    await api.patch(`/orders/${id}/status`, { status })
  }
}
