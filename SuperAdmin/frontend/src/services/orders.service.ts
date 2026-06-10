import api from './api'
import type { OrderDto, PaginatedResponse, OrderQueryParams } from '../types'

export const ordersService = {
  async getOrders(params: OrderQueryParams = {}): Promise<PaginatedResponse<OrderDto>> {
    const { data } = await api.get<PaginatedResponse<OrderDto>>('/orders', { params })
    return data
  }
  // Order status is read-only from SuperAdmin (the lifecycle is owned by the Spring backend).
}
