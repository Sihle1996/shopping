import { useQuery } from '@tanstack/react-query'
import { LifeBuoy, AlertTriangle } from 'lucide-react'
import { supportService } from '../../services/support.service'

export default function Escalations() {
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-escalated'],
    queryFn: () => supportService.getEscalated(),
    staleTime: 30_000
  })
  const { data: signals = [] } = useQuery({
    queryKey: ['support-signals'],
    queryFn: () => supportService.getStoreSignals(),
    staleTime: 30_000
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Customer Escalations</h1>
        <p className="text-gray-500 text-sm">
          Complaints customers escalated past the store to CraveIt — the platform's oversight of how stores treat customers.
        </p>
      </div>

      {/* Per-store support signal */}
      {signals.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Stores by support load</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {signals.map(s => (
              <div key={s.storeId ?? s.store} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-white truncate">{s.store ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {s.open} open · <span className={s.escalated > 0 ? 'text-orange-400 font-semibold' : ''}>{s.escalated} escalated</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && tickets.length === 0 && (
        <div className="text-center py-16">
          <LifeBuoy size={28} className="text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No escalations</p>
          <p className="text-gray-500 text-sm">No customer has escalated a store complaint to CraveIt.</p>
        </div>
      )}

      {tickets.map(t => (
        <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="font-semibold text-white">{t.subject}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.store ?? '—'} · {t.customer ?? '—'}</p>
            </div>
            <span className="text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
              <AlertTriangle size={11} /> Escalated
            </span>
          </div>
          <p className="text-sm text-gray-300">{t.message}</p>
          {t.escalationReason && (
            <div className="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-xl px-3 py-2">
              <p className="text-xs text-orange-300"><span className="font-semibold">Why escalated:</span> {t.escalationReason}</p>
            </div>
          )}
          {t.adminNotes && (
            <div className="mt-2 bg-gray-800/60 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-400"><span className="font-semibold">Store's reply:</span> {t.adminNotes}</p>
            </div>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Ticket status: {t.status}{t.escalatedAt ? ` · escalated ${new Date(t.escalatedAt).toLocaleString()}` : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
