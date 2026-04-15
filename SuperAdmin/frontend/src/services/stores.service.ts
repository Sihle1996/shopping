import api from './api'
import type { TenantDto, PaginatedResponse, StoreQueryParams, UpdateStoreDto, CreateStoreDto } from '../types'

export const storesService = {
  async getStores(params: StoreQueryParams = {}): Promise<PaginatedResponse<TenantDto>> {
    const { data } = await api.get<PaginatedResponse<TenantDto>>('/stores', { params })
    return data
  },

  async createStore(body: CreateStoreDto): Promise<TenantDto> {
    const { data } = await api.post<TenantDto>('/stores', body)
    return data
  },

  async updateStore(id: string, body: UpdateStoreDto): Promise<TenantDto> {
    const { data } = await api.put<TenantDto>(`/stores/${id}`, body)
    return data
  },

  async toggleActive(id: string): Promise<TenantDto> {
    const { data } = await api.patch<TenantDto>(`/stores/${id}/toggle-active`)
    return data
  },

  async deleteStore(id: string): Promise<void> {
    await api.delete(`/stores/${id}`)
  }
}
