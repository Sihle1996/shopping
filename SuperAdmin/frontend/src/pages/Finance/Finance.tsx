import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { TrendingUp, Wallet, CreditCard, Receipt, Truck } from 'lucide-react'

interface Summary {
  days: number; gmv: number; commissionRevenue: number; deliveryRevenue: number; orderCount: number
  subscriptionMrr: number; activeSubscriptions: number; trialSubscriptions: number
  payoutPending: number; payoutPaid: number
}
interface MonthRow { year: number; month: number; gmv: number; commission: number; orders: number }

const fmt = (v: number) => `R${(v ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function Card({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: typeof TrendingUp; accent: string
}) {
  return (
    <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</span>
        <Icon size={16} className={accent} />
      </div>
      <p className="text-2xl font-bold text-white font-numbers">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function Finance() {
  const [days, setDays] = useState(30)

  const { data: s, isLoading } = useQuery<Summary>({
    queryKey: ['finance-summary', days],
    queryFn: async () => (await api.get<Summary>(`/finance/summary?days=${days}`)).data
  })
  const { data: monthly = [] } = useQuery<MonthRow[]>({
    queryKey: ['finance-monthly'],
    queryFn: async () => (await api.get<MonthRow[]>('/finance/monthly')).data
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-gray-400 text-sm mt-0.5">Platform revenue, subscriptions &amp; payout liability</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {isLoading || !s ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card label="GMV" value={fmt(s.gmv)} sub={`${s.orderCount} delivered orders`} icon={TrendingUp} accent="text-blue-400" />
            <Card label="Commission" value={fmt(s.commissionRevenue)} sub="platform take on orders" icon={Receipt} accent="text-green-400" />
            <Card label="Delivery revenue" value={fmt(s.deliveryRevenue)} sub="platform delivery fees" icon={Truck} accent="text-amber-400" />
            <Card label="Subscription MRR" value={fmt(s.subscriptionMrr)} sub={`${s.activeSubscriptions} active · ${s.trialSubscriptions} trial`} icon={CreditCard} accent="text-purple-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card label="Payout liability (owed)" value={fmt(s.payoutPending)} sub="PENDING payouts" icon={Wallet} accent="text-red-400" />
            <Card label="Paid out" value={fmt(s.payoutPaid)} sub="PAID payouts" icon={Wallet} accent="text-green-400" />
          </div>

          <h2 className="text-sm font-bold text-gray-300 mb-2">Last 6 months</h2>
          <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
              <span>Month</span><span>GMV</span><span>Commission</span><span>Orders</span>
            </div>
            {monthly.length === 0 && <div className="text-gray-500 text-center py-6 text-sm">No delivered orders yet.</div>}
            {monthly.map(m => (
              <div key={`${m.year}-${m.month}`} className="grid grid-cols-4 gap-2 px-5 py-3 border-b border-gray-700/60 text-sm">
                <span className="text-white">{MONTHS[m.month]} {m.year}</span>
                <span className="text-gray-300 font-numbers">{fmt(m.gmv)}</span>
                <span className="text-green-400 font-numbers">{fmt(m.commission)}</span>
                <span className="text-gray-400 font-numbers">{m.orders}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
