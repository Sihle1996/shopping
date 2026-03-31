import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/auth.service'

interface AuthUser {
  email: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const email = authService.getEmail()
    const role = authService.getRole()
    if (email && role && authService.isAuthenticated()) {
      setUser({ email, role })
    }
  }, [])

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password)
    setUser({ email: result.email, role: result.role })
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
