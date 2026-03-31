import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/stores': 'Stores',
  '/users': 'Users',
  '/drivers': 'Drivers',
  '/subscriptions': 'Subscriptions'
}

export default function Header() {
  const location = useLocation()
  const { user } = useAuth()
  const title = pageTitles[location.pathname] ?? 'SuperAdmin'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
          {user?.role ?? 'SuperAdmin'}
        </span>
        <span className="text-sm text-gray-500">{user?.email}</span>
      </div>
    </header>
  )
}
