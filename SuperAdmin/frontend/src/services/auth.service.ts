import api from './api'

interface LoginResponse {
  token: string
  email: string
  role: string
  expiresAt: string
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('email', data.email)
    localStorage.setItem('role', data.role)
    localStorage.setItem('expiresAt', data.expiresAt)
    return data
  },

  logout(): void {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('role')
    localStorage.removeItem('expiresAt')
  },

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token')
    if (!token) return false
    const expiresAt = localStorage.getItem('expiresAt')
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      this.logout()
      return false
    }
    return true
  },

  getToken(): string | null {
    return localStorage.getItem('token')
  },

  getEmail(): string | null {
    return localStorage.getItem('email')
  },

  getRole(): string | null {
    return localStorage.getItem('role')
  }
}
