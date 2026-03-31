import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleAutoLogout() {
    const expiresAt = localStorage.getItem('expiresAt')
    if (!expiresAt) return
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      doLogout()
      return
    }
    timerRef.current = setTimeout(() => doLogout(), ms)
  }

  function doLogout() {
    authService.logout()
    setUser(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    const email = authService.getEmail()
    const role = authService.getRole()
    if (email && role && authService.isAuthenticated()) {
      setUser({ email, role })
      scheduleAutoLogout()
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password)
    setUser({ email: result.email, role: result.role })
    scheduleAutoLogout()
  }

  const logout = () => doLogout()

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
