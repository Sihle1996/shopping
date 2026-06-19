import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useDebounce } from '../../hooks/useDebounce'

interface PromoRow {
  id: string; code?: string; title: string; promoType?: string
  discountPercent?: number; discountAmount?: number; active: boolean; featured: boolean
  startAt: string; endAt: string; maxRedemptions?: number; redemptionCount: number; storeName?: string
}
interface Paged { data: PromoRow[]; total: number; page: number; pageSize: number; totalPages: number }

function discountText(p: PromoRow) {
  if (p.discountPercent) return `${Number(p.discountPercent)}%`
  if (p.discountAmount) return `R${Number(p.discountAmount)}`
  if (p.promoType === 'FREE_DELIVERY') return 'Free delivery'
  return '—'
}

export default function Promotions() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)

  const { data, isLoading } = useQuery<Paged>({
    queryKey: ['promotions', debounced, activeOnly, page],
    queryFn: async () => (await api.get<Paged>('/promotions', {
      params: { search: debounced || undefined, activeOnly: activeOnly || undefined, page, pageSize: 50 }
    })).data
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/promotions/${id}/active`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); showToast('Promotion updated', 'success') },
    onError: () => showToast('Failed to update', 'error')
  })
  const rows = data?.data ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Promotions</h1>
        <p className="text-gray-400 text-sm mt-0.5">Oversight across all stores · disable abusive promos</p>
      </div>

      <div className="flex gap-3 mb-4 items-center">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search code or title…"
          className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700" />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1) }} /> Active only
        </label>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_90px_100px_80px] gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>Store / Promo</span><span>Code</span><span>Discount</span><span>Redemptions</span><span></span>
          </div>
          {rows.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">No promotions.</div>}
          {rows.map(p => (
            <div key={p.id} className="grid grid-cols-[1fr_110px_90px_100px_80px] gap-2 px-5 py-3 border-b border-gray-700/60 text-sm items-center">
              <div className="min-w-0">
                <p className="text-white truncate">{p.storeName ?? '—'}</p>
                <p className="text-gray-500 text-xs truncate">{p.title}</p>
              </div>
              <span className="text-gray-300 text-xs font-mono truncate">{p.code ?? '—'}</span>
              <span className="text-green-400 text-xs">{discountText(p)}</span>
              <span className="text-gray-400 text-xs">{p.redemptionCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}</span>
              <button onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  p.active
                    ? 'bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400'
                    : 'bg-gray-600/30 text-gray-400 hover:bg-green-500/15 hover:text-green-400'}`}>
                {p.active ? 'Active' : 'Off'}
              </button>
            </div>
          ))}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-400">
              <span>Page {data.page} of {data.totalPages} · {data.total} promos</span>
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
