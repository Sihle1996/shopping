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
    return data
  },

  logout(): void {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('role')
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token')
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
