import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Utensils, AlertCircle } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gray-900 p-12">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">
            Super<span className="text-orange-500">Admin</span>
          </span>
          <span className="w-2 h-2 rounded-full bg-orange-500 mt-1" />
        </div>

        <div>
          <div className="mb-8 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10">
            <Utensils size={32} className="text-orange-500" />
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Manage your<br />
            <span className="text-orange-500">FastFood</span> empire
          </h2>
          <p className="text-gray-400 text-lg">
            One dashboard to rule all stores, drivers,<br />
            subscriptions, and orders across the platform.
          </p>
        </div>

        <div className="flex gap-6 text-sm text-gray-600">
          <span>Platform v1.0</span>
          <span>© 2026 FastFood SaaS</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
            <p className="text-sm text-gray-500">Enter your SuperAdmin credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@platform.com"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-xs text-center text-gray-400">
            Restricted to SuperAdmin accounts only
          </p>
        </div>
      </div>
    </div>
  )
}
