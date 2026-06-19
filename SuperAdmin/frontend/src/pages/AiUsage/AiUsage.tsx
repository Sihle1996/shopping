import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Sparkles, Phone, Coins } from 'lucide-react'

interface TenantUsage { tenantId: string; name?: string; calls: number; tokens: number; cost: number }
interface UsageResp {
  month: string | null; platformTotalCost: number; platformTotalCalls: number
  platformTotalTokens: number; tenants: TenantUsage[]
}

const fmtR = (v: number) => `R${(v ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (v: number) => (v ?? 0).toLocaleString('en-ZA')

export default function AiUsage() {
  const [month, setMonth] = useState('')

  const { data: months = [] } = useQuery<string[]>({
    queryKey: ['ai-months'],
    queryFn: async () => (await api.get<string[]>('/ai-usage/months')).data
  })
  const { data, isLoading } = useQuery<UsageResp>({
    queryKey: ['ai-usage', month],
    queryFn: async () => (await api.get<UsageResp>('/ai-usage', { params: { month: month || undefined } })).data
  })
  const tenants = data?.tenants ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Usage &amp; Cost</h1>
          <p className="text-gray-400 text-sm mt-0.5">Per-store AI consumption (margin protection)</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700">
          <option value="">All time</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500 uppercase font-semibold">Est. cost</span><Coins size={16} className="text-amber-400" /></div>
            <p className="text-2xl font-bold text-white font-numbers">{fmtR(data.platformTotalCost)}</p>
          </div>
          <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500 uppercase font-semibold">Calls</span><Phone size={16} className="text-blue-400" /></div>
            <p className="text-2xl font-bold text-white font-numbers">{num(data.platformTotalCalls)}</p>
          </div>
          <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500 uppercase font-semibold">Tokens</span><Sparkles size={16} className="text-purple-400" /></div>
            <p className="text-2xl font-bold text-white font-numbers">{num(data.platformTotalTokens)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>Store</span><span>Calls</span><span>Tokens</span><span>Est. cost</span>
          </div>
          {tenants.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">No AI usage recorded.</div>}
          {tenants.map(t => (
            <div key={t.tenantId} className="grid grid-cols-4 gap-2 px-5 py-3 border-b border-gray-700/60 text-sm items-center">
              <span className="text-white truncate">{t.name ?? '—'}</span>
              <span className="text-gray-300 font-numbers">{num(t.calls)}</span>
              <span className="text-gray-400 font-numbers">{num(t.tokens)}</span>
              <span className="text-amber-400 font-numbers font-bold">{fmtR(t.cost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
