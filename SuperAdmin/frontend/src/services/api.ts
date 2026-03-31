import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
})

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle auth + network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('email')
      localStorage.removeItem('role')
      localStorage.removeItem('expiresAt')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 429) {
      return Promise.reject(new Error('Too many attempts. Please wait a minute and try again.'))
    }

    if (!error.response) {
      return Promise.reject(new Error('Unable to reach the server. Check your connection.'))
    }

    return Promise.reject(error)
  }
)

export default api
