import api from './api'
import type { UserDto, PaginatedResponse, DriverQueryParams } from '../types'

export const driversService = {
  async getDrivers(params: DriverQueryParams = {}): Promise<PaginatedResponse<UserDto>> {
    const { data } = await api.get<PaginatedResponse<UserDto>>('/drivers', { params })
    return data
  },

  async updateDriverStatus(id: string, driverStatus: string): Promise<UserDto> {
    const { data } = await api.patch<UserDto>(`/drivers/${id}/status`, { driverStatus })
    return data
  }
}
