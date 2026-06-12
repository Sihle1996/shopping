import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, AlertTriangle, Store } from 'lucide-react'
import { supportService } from '../../services/support.service'
import { useToast } from '../../context/ToastContext'

function Spinner() {
  return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
}

function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center py-16">{icon}
      <p className="text-white font-semibold mb-1">{title}</p>
      <p className="text-gray-500 text-sm">{sub}</p>
    </div>
  )
}

function ReplyBox({ id, existingNote, reviewedAt, onSaved }: { id: string; existingNote: string | null; reviewedAt: string | null; onSaved: () => void }) {
  const { showToast } = useToast()
  const [note, setNote] = useState(existingNote ?? '')
  const mutation = useMutation({
    mutationFn: ({ resolve }: { resolve: boolean }) => supportService.addNote(id, note, resolve),
    onSuccess: () => { showToast('Reply saved', 'success'); onSaved() },
    onError: () => showToast('Failed to save', 'error')
  })
  return (
    <div className="mt-3 border-t border-gray-800 pt-3">
      {reviewedAt && <p className="text-[11px] text-gray-500 mb-1">Last actioned {new Date(reviewedAt).toLocaleString()}</p>}
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
        placeholder="Reply to the store / note for the platform record…"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500" />
      <div className="flex gap-2 mt-2">
        <button onClick={() => mutation.mutate({ resolve: false })} disabled={mutation.isPending || !note.trim()}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold disabled:opacity-50">Save reply</button>
        <button onClick={() => mutation.mutate({ resolve: true })} disabled={mutation.isPending}
          className="px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-semibold border border-green-600/30 disabled:opacity-50">Save &amp; mark resolved</button>
      </div>
    </div>
  )
}

export default function Escalations() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'escalations' | 'requests'>('escalations')

  const { data: escalated = [], isLoading: escLoading } = useQuery({ queryKey: ['support-escalated'], queryFn: () => supportService.getEscalated(), staleTime: 30_000 })
  const { data: requests = [], isLoading: reqLoading } = useQuery({ queryKey: ['support-platform'], queryFn: () => supportService.getPlatform(), staleTime: 30_000, enabled: tab === 'requests' })
  const { data: signals = [] } = useQuery({ queryKey: ['support-signals'], queryFn: () => supportService.getStoreSignals(), staleTime: 30_000 })

  const refetchEsc = () => qc.invalidateQueries({ queryKey: ['support-escalated'] })
  const refetchReq = () => qc.invalidateQueries({ queryKey: ['support-platform'] })

  const tabClass = (k: string) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === k ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-200'}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Support oversight</h1>
        <p className="text-gray-500 text-sm">Customer complaints escalated past stores, and store requests to CraveIt — with a way to reply.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('escalations')} className={tabClass('escalations')}>
          Customer escalations
          {escalated.length > 0 && <span className="ml-2 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{escalated.length}</span>}
        </button>
        <button onClick={() => setTab('requests')} className={tabClass('requests')}>Store requests</button>
      </div>

      {tab === 'escalations' && (
        <>
          {signals.length > 0 && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Stores by support load</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {signals.map(s => (
                  <div key={s.storeId ?? s.store} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <p className="text-sm font-semibold text-white truncate">{s.store ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.open} open · <span className={s.escalated > 0 ? 'text-orange-400 font-semibold' : ''}>{s.escalated} escalated</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {escLoading && <Spinner />}
          {!escLoading && escalated.length === 0 && <Empty icon={<LifeBuoy size={28} className="text-gray-600 mx-auto mb-3" />} title="No escalations" sub="No customer has escalated a store complaint to CraveIt." />}
          {escalated.map(t => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0"><p className="font-semibold text-white">{t.subject}</p><p className="text-xs text-gray-500 mt-0.5">{t.store ?? '—'} · {t.customer ?? '—'}</p></div>
                <span className="text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"><AlertTriangle size={11} /> Escalated</span>
              </div>
              <p className="text-sm text-gray-300">{t.message}</p>
              {t.escalationReason && <div className="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-xl px-3 py-2"><p className="text-xs text-orange-300"><span className="font-semibold">Why escalated:</span> {t.escalationReason}</p></div>}
              {t.adminNotes && <div className="mt-2 bg-gray-800/60 rounded-xl px-3 py-2"><p className="text-xs text-gray-400"><span className="font-semibold">Store's reply:</span> {t.adminNotes}</p></div>}
              <ReplyBox id={t.id} existingNote={t.platformNote} reviewedAt={t.platformReviewedAt} onSaved={refetchEsc} />
            </div>
          ))}
        </>
      )}

      {tab === 'requests' && (
        <>
          {reqLoading && <Spinner />}
          {!reqLoading && requests.length === 0 && <Empty icon={<Store size={28} className="text-gray-600 mx-auto mb-3" />} title="No store requests" sub="No store has raised a request to CraveIt." />}
          {requests.map(t => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0"><p className="font-semibold text-white">{t.subject}</p><p className="text-xs text-gray-500 mt-0.5">{t.store ?? '—'} · {t.requester ?? '—'}</p></div>
                <span className="text-[11px] font-semibold text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full flex-shrink-0">{t.status}</span>
              </div>
              <p className="text-sm text-gray-300">{t.message}</p>
              <ReplyBox id={t.id} existingNote={t.platformNote} reviewedAt={t.platformReviewedAt} onSaved={refetchReq} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
