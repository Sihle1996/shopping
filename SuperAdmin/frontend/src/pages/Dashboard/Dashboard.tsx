import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../services/dashboard.service'
import StatCard from '../../components/common/StatCard'
import {
  Store,
  CheckCircle,
  Users,
  Truck,
  ShoppingBag,
  DollarSign,
  Clock
} from 'lucide-react'

function formatRevenue(val: number) {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}K`
  return `R${val}`
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: dashboardService.getStats
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stats = data ?? {
    totalStores: 0,
    activeStores: 0,
    totalUsers: 0,
    totalDrivers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  }

  return (
    <div className="space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Stores"
          value={stats.totalStores}
          subtitle="All registered tenants"
          icon={Store}
          color="blue"
        />
        <StatCard
          title="Active Stores"
          value={stats.activeStores}
          subtitle={`${stats.totalStores > 0 ? Math.round((stats.activeStores / stats.totalStores) * 100) : 0}% of total`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle="Registered customers"
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Total Drivers"
          value={stats.totalDrivers.toLocaleString()}
          subtitle="Across all stores"
          icon={Truck}
          color="orange"
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          subtitle="All time"
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={formatRevenue(stats.totalRevenue)}
          subtitle="Platform earnings"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders}
          subtitle="Awaiting fulfillment"
          icon={Clock}
          color="red"
        />
      </div>

      {/* Quick info bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Store Activation Rate</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{
                    width: `${stats.totalStores > 0 ? (stats.activeStores / stats.totalStores) * 100 : 0}%`
                  }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">
                {stats.totalStores > 0
                  ? Math.round((stats.activeStores / stats.totalStores) * 100)
                  : 0}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Revenue / Store</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {stats.totalStores > 0
                ? formatRevenue(Math.round(stats.totalRevenue / stats.totalStores))
                : 'R0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Orders / Store</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {stats.totalStores > 0
                ? Math.round(stats.totalOrders / stats.totalStores).toLocaleString()
                : '0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending Order Rate</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {stats.totalOrders > 0
                ? `${((stats.pendingOrders / stats.totalOrders) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
