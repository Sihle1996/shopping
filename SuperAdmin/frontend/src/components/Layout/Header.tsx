import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Platform overview & analytics' },
  '/stores':    { title: 'Stores', subtitle: 'Manage restaurant tenants' },
  '/users':     { title: 'Users', subtitle: 'Manage platform users' },
  '/drivers':   { title: 'Drivers', subtitle: 'Manage delivery drivers' },
  '/orders':        { title: 'Orders', subtitle: 'Platform-wide order activity' },
  '/subscriptions': { title: 'Subscriptions', subtitle: 'Plans & billing' }
}

export default function Header() {
  const location = useLocation()
  const { user } = useAuth()
  const page = pageTitles[location.pathname] ?? { title: 'SuperAdmin', subtitle: '' }

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0"
      style={{ background: '#0d1117' }}
    >
      <div>
        <h1 className="text-lg font-bold text-white leading-tight">{page.title}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* User badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-800" style={{ background: '#161b22' }}>
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
            {(user?.email ?? 'SA').slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-gray-400 hidden sm:block max-w-32 truncate">{user?.email}</span>
        </div>
      </div>
    </header>
  )
}
