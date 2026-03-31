import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../services/dashboard.service'
import StatCard from '../../components/common/StatCard'
import { Store, CheckCircle, Users, Truck, ShoppingBag, DollarSign, Clock, TrendingUp, AlertCircle } from 'lucide-react'

function formatRevenue(val: number) {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}K`
  return `R${val.toFixed(0)}`
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-28 animate-pulse shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gray-100 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-2.5 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: dashboardService.getStats
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={20} />
        <span className="text-sm">Failed to load stats — {(error as Error).message}</span>
      </div>
    )
  }

  const s = data ?? { totalStores: 0, activeStores: 0, totalUsers: 0, totalDrivers: 0, totalOrders: 0, totalRevenue: 0, pendingOrders: 0 }
  const activePct = s.totalStores > 0 ? Math.round((s.activeStores / s.totalStores) * 100) : 0
  const pendingPct = s.totalOrders > 0 ? ((s.pendingOrders / s.totalOrders) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Stores" value={s.totalStores} subtitle="All registered tenants" icon={Store} color="blue" />
        <StatCard title="Active Stores" value={s.activeStores} subtitle={`${activePct}% of total`} icon={CheckCircle} color="green" />
        <StatCard title="Total Users" value={s.totalUsers.toLocaleString()} subtitle="Registered customers" icon={Users} color="purple" />
        <StatCard title="Total Drivers" value={s.totalDrivers.toLocaleString()} subtitle="Across all stores" icon={Truck} color="orange" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={s.totalOrders.toLocaleString()} subtitle="All time" icon={ShoppingBag} color="blue" />
        <StatCard title="Total Revenue" value={formatRevenue(s.totalRevenue)} subtitle="From delivered orders" icon={DollarSign} color="green" />
        <StatCard title="Pending Orders" value={s.pendingOrders} subtitle={`${pendingPct}% of total`} icon={Clock} color="red" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <TrendingUp size={16} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-800">Platform Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          {[
            { label: 'Store Activation Rate', value: `${activePct}%`, bar: activePct, color: 'bg-green-500' },
            { label: 'Avg Revenue / Store', value: s.totalStores > 0 ? formatRevenue(Math.round(s.totalRevenue / s.totalStores)) : 'R0', bar: null },
            { label: 'Avg Orders / Store', value: s.totalStores > 0 ? Math.round(s.totalOrders / s.totalStores).toLocaleString() : '0', bar: null },
            { label: 'Pending Order Rate', value: `${pendingPct}%`, bar: parseFloat(pendingPct), color: 'bg-orange-500' }
          ].map((item, i) => (
            <div key={i} className="px-6 py-5">
              <p className="text-xs text-gray-400 font-medium mb-1">{item.label}</p>
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
              {item.bar !== null && item.bar !== undefined && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${'color' in item ? item.color : 'bg-blue-500'} rounded-full`} style={{ width: `${Math.min(item.bar, 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {s.pendingOrders > 10 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <Clock size={16} className="text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-700">
            <strong>{s.pendingOrders} pending orders</strong> across the platform. Check with store admins.
          </p>
        </div>
      )}
    </div>
  )
}
