import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../services/dashboard.service'
import StatCard from '../../components/common/StatCard'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Store, CheckCircle, Users, Truck, ShoppingBag,
  DollarSign, Clock, AlertCircle
} from 'lucide-react'

function formatRevenue(val: number) {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}K`
  return `R${val.toFixed(0)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#22c55e',
  Pending: '#f97316',
  Preparing: '#3b82f6',
  'Out for Delivery': '#8b5cf6',
  Cancelled: '#ef4444'
}

const PLAN_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#6b7280']

const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #30363d',
    background: '#161b22',
    color: '#e6edf3',
    fontSize: 12
  }
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl border border-gray-800 p-5 h-28 animate-pulse"
      style={{ background: '#161b22' }}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gray-800 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-gray-800 rounded w-2/3" />
          <div className="h-7 bg-gray-700 rounded w-1/2" />
          <div className="h-2.5 bg-gray-800 rounded w-3/4" />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-800 overflow-hidden ${className}`}
      style={{ background: '#161b22' }}
    >
      <div className="px-5 py-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function Dashboard() {
  const refetchInterval = 30_000

  const stats = useQuery({ queryKey: ['stats'], queryFn: dashboardService.getStats, refetchInterval })
  const ordersByStatus = useQuery({ queryKey: ['orders-by-status'], queryFn: dashboardService.getOrdersByStatus, refetchInterval })
  const ordersOverTime = useQuery({ queryKey: ['orders-over-time'], queryFn: () => dashboardService.getOrdersOverTime(30), refetchInterval })
  const topStores = useQuery({ queryKey: ['top-stores'], queryFn: dashboardService.getTopStores, refetchInterval })
  const storesByPlan = useQuery({ queryKey: ['stores-by-plan'], queryFn: dashboardService.getStoresByPlan, refetchInterval })

  if (stats.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 h-72 animate-pulse" style={{ background: '#161b22' }} />
          ))}
        </div>
      </div>
    )
  }

  if (stats.error) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <AlertCircle size={20} />
        <span className="text-sm">Failed to load stats — {(stats.error as Error).message}</span>
      </div>
    )
  }

  const s = stats.data!
  const activePct = s.totalStores > 0 ? Math.round((s.activeStores / s.totalStores) * 100) : 0

  return (
    <div className="space-y-5">
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Stores" value={s.totalStores} subtitle="All registered tenants" icon={Store} color="blue" />
        <StatCard title="Active Stores" value={s.activeStores} subtitle={`${activePct}% of total`} icon={CheckCircle} color="green" />
        <StatCard title="Total Users" value={s.totalUsers.toLocaleString()} subtitle="Registered customers" icon={Users} color="purple" />
        <StatCard title="Total Drivers" value={s.totalDrivers.toLocaleString()} subtitle="Across all stores" icon={Truck} color="orange" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={s.totalOrders.toLocaleString()} subtitle="All time" icon={ShoppingBag} color="blue" />
        <StatCard title="Total Revenue" value={formatRevenue(s.totalRevenue)} subtitle="From delivered orders" icon={DollarSign} color="green" />
        <StatCard title="Pending Orders" value={s.pendingOrders} subtitle="Awaiting fulfillment" icon={Clock} color="red" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Orders & Revenue — Last 30 Days" className="lg:col-span-2">
          {ordersOverTime.isLoading ? (
            <div className="h-56 animate-pulse bg-gray-800 rounded-lg" />
          ) : (ordersOverTime.data?.length ?? 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-600">No order data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ordersOverTime.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `R${v}`} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(val: number, name: string) => [name === 'revenue' ? `R${val.toFixed(0)}` : val, name === 'revenue' ? 'Revenue' : 'Orders']}
                  labelFormatter={formatDate}
                />
                <Area yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOrders)" name="orders" dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#colorRevenue)" name="revenue" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Orders by Status">
          {ordersByStatus.isLoading ? (
            <div className="h-56 animate-pulse bg-gray-800 rounded-lg" />
          ) : (ordersByStatus.data?.length ?? 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-600">No data yet</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={ordersByStatus.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="count"
                    nameKey="status"
                    paddingAngle={2}
                  >
                    {ordersByStatus.data!.map((entry, index) => (
                      <Cell key={index} fill={STATUS_COLORS[entry.status] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {ordersByStatus.data!.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[entry.status] ?? '#6b7280' }} />
                      <span className="text-gray-400">{entry.status}</span>
                    </div>
                    <span className="font-semibold text-gray-200">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Stores by Revenue">
          {topStores.isLoading ? (
            <div className="h-48 animate-pulse bg-gray-800 rounded-lg" />
          ) : (topStores.data?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-600">No store data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topStores.data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => `R${v}`} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(val: number) => [`R${val.toFixed(0)}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Stores by Subscription Plan">
          {storesByPlan.isLoading ? (
            <div className="h-48 animate-pulse bg-gray-800 rounded-lg" />
          ) : (storesByPlan.data?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-600">No plan data yet</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={storesByPlan.data} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="plan" paddingAngle={3}>
                    {storesByPlan.data!.map((_, index) => (
                      <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {storesByPlan.data!.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                      <span className="text-sm text-gray-400 font-medium">{entry.plan}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-200">{entry.count}</span>
                      <span className="text-xs text-gray-600 ml-1">stores</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
