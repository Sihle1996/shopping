import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Star, Trash2 } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'

interface ReviewRow { id: string; rating: number; comment?: string; createdAt?: string; storeName?: string; reviewer?: string }
interface Paged { data: ReviewRow[]; total: number; page: number; pageSize: number; totalPages: number }

export default function Reviews() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [maxRating, setMaxRating] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)

  const { data, isLoading } = useQuery<Paged>({
    queryKey: ['reviews', debounced, maxRating, page],
    queryFn: async () => (await api.get<Paged>('/reviews', {
      params: { search: debounced || undefined, maxRating: maxRating || undefined, days: 3650, page, pageSize: 50 }
    })).data
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reviews'] }); showToast('Review removed', 'success') },
    onError: () => showToast('Failed to remove review', 'error')
  })
  const rows = data?.data ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reviews</h1>
        <p className="text-gray-400 text-sm mt-0.5">Moderate customer reviews across stores</p>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search comments…"
          className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700" />
        <select value={maxRating} onChange={e => { setMaxRating(e.target.value); setPage(1) }}
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700">
          <option value="">All ratings</option>
          <option value="2">≤ 2 ★ (low)</option>
          <option value="3">≤ 3 ★</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[90px_120px_1fr_40px] gap-3 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>Rating</span><span>Store</span><span>Comment</span><span></span>
          </div>
          {rows.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">No reviews.</div>}
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-[90px_120px_1fr_40px] gap-3 px-5 py-3 border-b border-gray-700/60 text-sm items-center">
              <span className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: Math.max(0, Math.min(5, r.rating)) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
              </span>
              <span className="text-white truncate text-xs">{r.storeName ?? '—'}</span>
              <div className="min-w-0">
                <p className="text-gray-300 truncate" title={r.comment}>{r.comment ?? '—'}</p>
                <p className="text-gray-600 text-[10px] truncate">
                  {r.reviewer ?? ''}{r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString('en-ZA')}` : ''}
                </p>
              </div>
              <button onClick={() => { if (window.confirm('Remove this review?')) del.mutate(r.id) }}
                className="text-gray-500 hover:text-red-400" title="Remove review">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-400">
              <span>Page {data.page} of {data.totalPages} · {data.total} reviews</span>
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
