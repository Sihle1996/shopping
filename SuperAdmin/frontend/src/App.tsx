import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import PrivateRoute from './components/PrivateRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Stores from './pages/Stores/Stores'
import Users from './pages/Users/Users'
import Drivers from './pages/Drivers/Drivers'
import Subscriptions from './pages/Subscriptions/Subscriptions'
import NotFound from './pages/NotFound/NotFound'

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes wrapped in layout */}
            <Route
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stores" element={<Stores />} />
              <Route path="/users" element={<Users />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
