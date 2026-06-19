import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { useDebounce } from '../../hooks/useDebounce'

interface AuditRow {
  id: string; action: string; actorEmail?: string; actorRole?: string; createdAt: string
  entityType?: string; entityId?: string; source: string; summary?: string; tenantId?: string
}
interface Paged { data: AuditRow[]; total: number; page: number; pageSize: number; totalPages: number }

const sourceColor: Record<string, string> = {
  ADMIN: 'text-blue-400', SUPERADMIN: 'text-purple-400', DRIVER: 'text-amber-400',
  SYSTEM: 'text-gray-400', USER: 'text-green-400'
}

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)

  const { data: actions = [] } = useQuery<string[]>({
    queryKey: ['audit-actions'],
    queryFn: async () => (await api.get<string[]>('/audit/actions')).data
  })
  const { data, isLoading } = useQuery<Paged>({
    queryKey: ['audit', debounced, action, page],
    queryFn: async () => (await api.get<Paged>('/audit', {
      params: { search: debounced || undefined, action: action || undefined, page, pageSize: 50 }
    })).data
  })

  const rows = data?.data ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-0.5">Platform &amp; store activity trail</p>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search summary or actor…"
          className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700" />
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700">
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading…</div>
      ) : (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[140px_170px_1fr_140px] gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>When</span><span>Action</span><span>Summary</span><span>Actor</span>
          </div>
          {rows.length === 0 && <div className="text-gray-500 text-center py-8 text-sm">No events.</div>}
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-[140px_170px_1fr_140px] gap-2 px-5 py-3 border-b border-gray-700/60 text-sm items-center">
              <span className="text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="text-gray-200 text-xs font-medium truncate" title={r.action}>{r.action}</span>
              <span className="text-gray-300 truncate" title={r.summary}>{r.summary ?? '—'}</span>
              <span className={`text-xs truncate ${sourceColor[r.source] ?? 'text-gray-400'}`} title={r.actorEmail}>
                {r.actorEmail ?? r.source}
              </span>
            </div>
          ))}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-400">
              <span>Page {data.page} of {data.totalPages} · {data.total} events</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-lg bg-gray-700 disabled:opacity-40">Prev</button>
                <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg bg-gray-700 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
