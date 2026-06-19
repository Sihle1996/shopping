import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { RotateCcw } from 'lucide-react'

interface RefundRow { id: string; amountRand: number; description?: string; orderId?: string; createdAt?: string; storeName?: string }
interface Paged { data: RefundRow[]; total: number; totalRefunded: number; page: number; pageSize: number; totalPages: number }

const fmt = (v: number) => `R${(v ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Refunds() {
  const [days, setDays] = useState(90)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<Paged>({
    queryKey: ['refunds', days, page],
    queryFn: async () => (await api.get<Paged>('/refunds', { params: { days, page, pageSize: 50 } })).data
  })
  const rows = data?.data ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Refunds</h1>
          <p className="text-gray-400 text-sm mt-0.5">Store ledger refunds (cancelled / refunded orders)</p>
        </div>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {data && (
        <div className="bg-gray-800/60 rounded-2xl p-5 mb-4 border border-gray-700/50 flex items-center gap-3">
          <RotateCcw size={18} className="text-red-400" />
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Total refunded</p>
            <p className="text-2xl font-bold text-white font-numbers">
              {fmt(data.totalRefunded)} <span className="text-sm text-gray-500 font-normal">· {data.total} refunds</span>
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[130px_1fr_120px] gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>When</span><span>Store / Note</span><span>Amount</span>
          </div>
          {rows.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">No refunds in this period.</div>}
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-[130px_1fr_120px] gap-2 px-5 py-3 border-b border-gray-700/60 text-sm items-center">
              <span className="text-gray-400 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-ZA') : '—'}</span>
              <div className="min-w-0">
                <p className="text-white truncate">{r.storeName ?? '—'}</p>
                <p className="text-gray-500 text-xs truncate">{r.description ?? ''}</p>
              </div>
              <span className="text-red-400 font-numbers font-bold">−{fmt(r.amountRand)}</span>
            </div>
          ))}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-400">
              <span>Page {data.page} of {data.totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg bg-gray-700 disabled:opacity-40">Prev</button>
                <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-gray-700 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
