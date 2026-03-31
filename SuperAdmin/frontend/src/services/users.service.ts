import api from './api'
import type { UserDto, PaginatedResponse, UserQueryParams, UpdateUserDto } from '../types'

export const usersService = {
  async getUsers(params: UserQueryParams = {}): Promise<PaginatedResponse<UserDto>> {
    const { data } = await api.get<PaginatedResponse<UserDto>>('/users', { params })
    return data
  },

  async updateUser(id: string, body: UpdateUserDto): Promise<UserDto> {
    const { data } = await api.patch<UserDto>(`/users/${id}`, body)
    return data
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`)
  }
}
