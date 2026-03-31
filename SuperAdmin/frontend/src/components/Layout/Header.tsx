import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Bell, Search } from 'lucide-react'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Platform overview & analytics' },
  '/stores':    { title: 'Stores', subtitle: 'Manage restaurant tenants' },
  '/users':     { title: 'Users', subtitle: 'Manage platform users' },
  '/drivers':   { title: 'Drivers', subtitle: 'Manage delivery drivers' },
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
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Search…"
            className="w-48 pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-800 focus:outline-none focus:border-gray-600 text-gray-400 placeholder-gray-700"
            style={{ background: '#161b22' }}
          />
        </div>

        {/* Bell */}
        <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
        </button>

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
