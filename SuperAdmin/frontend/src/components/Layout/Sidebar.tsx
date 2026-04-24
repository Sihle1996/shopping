import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Store, Users, Truck, CreditCard, LogOut, Zap, ShoppingBag, Settings, ClipboardCheck, Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { enrollmentService } from '../../services/enrollment.service'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/drivers', label: 'Drivers', icon: Truck },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/enrollment', label: 'Enrollments', icon: ClipboardCheck },
  { to: '/payouts', label: 'Payouts', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Settings }
]

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const { data: pending = [] } = useQuery({
    queryKey: ['enrollment-pending'],
    queryFn: () => enrollmentService.getPending(),
    staleTime: 60_000,
    refetchInterval: 120_000
  })

  const pendingCount = pending.length

  return (
    <aside
      className="flex flex-col text-white border-r border-gray-800"
      style={{ width: 240, minHeight: '100vh', flexShrink: 0, background: '#0d1117' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-white" fill="white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">FastFood</p>
          <p className="text-xs text-gray-500 leading-tight">Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-orange-400' : ''} />
                <span className="flex-1">{label}</span>
                {to === '/enrollment' && pendingCount > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 px-3 py-4 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {getInitials(user?.email ?? 'SA')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">{user?.email}</p>
            <p className="text-xs text-gray-600">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
