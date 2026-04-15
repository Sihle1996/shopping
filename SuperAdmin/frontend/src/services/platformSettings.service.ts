import api from './api'
import type { PlatformSettingsDto } from '../types'

export const platformSettingsService = {
  async getSettings(): Promise<PlatformSettingsDto> {
    const { data } = await api.get<PlatformSettingsDto>('/platform-settings')
    return data
  },

  async updateSettings(body: Omit<PlatformSettingsDto, 'updatedAt'>): Promise<PlatformSettingsDto> {
    const { data } = await api.put<PlatformSettingsDto>('/platform-settings', body)
    return data
  }
}
