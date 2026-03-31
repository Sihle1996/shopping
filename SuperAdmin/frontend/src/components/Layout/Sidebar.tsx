import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Store,
  Users,
  Truck,
  CreditCard,
  LogOut
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/drivers', label: 'Drivers', icon: Truck },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard }
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="flex flex-col bg-gray-900 text-white"
      style={{ width: 240, minHeight: '100vh', flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <span className="text-2xl font-bold tracking-tight text-white">
          Super<span className="text-orange-500">Admin</span>
        </span>
        <span className="w-2 h-2 rounded-full bg-orange-500 mt-1" />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white border-l-2 border-orange-500 pl-[10px]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-gray-800 px-4 py-4">
        <p className="text-xs text-gray-500 truncate mb-3">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  )
}
