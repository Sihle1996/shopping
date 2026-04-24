import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { CheckCircle, Clock, PauseCircle, PlusCircle } from 'lucide-react'

interface Payout {
  id: string
  tenant?: { id: string; name: string }
  periodStart?: string
  periodEnd?: string
  grossRevenue: number
  platformFeePercent: number
  platformFee: number
  netAmount: number
  status: 'PENDING' | 'PAID' | 'ON_HOLD'
  createdAt: string
  paidAt?: string
  reference?: string
  notes?: string
}

interface Tenant { id: string; name: string }

function fmt(v: number) {
  return `R${v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-500/15 text-amber-400',
    PAID: 'bg-green-500/15 text-green-400',
    ON_HOLD: 'bg-red-500/15 text-red-400',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? ''}`}>
      {status}
    </span>
  )
}

export default function Payouts() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markRef, setMarkRef] = useState('')
  const [form, setForm] = useState({
    tenantId: '', periodStart: '', periodEnd: '',
    grossRevenue: '', platformFeePercent: '', platformFee: '', netAmount: '', notes: ''
  })

  const { data: payouts = [], isLoading } = useQuery<Payout[]>({
    queryKey: ['superadmin-payouts'],
    queryFn: async () => { const { data } = await api.get<Payout[]>('/superadmin/payouts'); return data }
  })

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants-list'],
    queryFn: async () => { const { data } = await api.get<Tenant[]>('/superadmin/tenants'); return data }
  })

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/superadmin/payouts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-payouts'] })
      setShowCreate(false)
      showToast('Payout created', 'success')
    },
    onError: () => showToast('Failed to create payout', 'error')
  })

  const markPaidMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      api.patch(`/superadmin/payouts/${id}`, { status: 'PAID', reference }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-payouts'] })
      setMarkingId(null)
      showToast('Payout marked as paid', 'success')
    },
    onError: () => showToast('Failed to update payout', 'error')
  })

  const handleCreate = () => {
    createMutation.mutate({
      ...form,
      grossRevenue: parseFloat(form.grossRevenue) || 0,
      platformFeePercent: parseFloat(form.platformFeePercent) || 0,
      platformFee: parseFloat(form.platformFee) || 0,
      netAmount: parseFloat(form.netAmount) || 0,
      periodStart: form.periodStart ? new Date(form.periodStart).toISOString() : null,
      periodEnd: form.periodEnd ? new Date(form.periodEnd).toISOString() : null,
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Payouts</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage store settlements and payouts</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <PlusCircle size={16} /> Create Payout
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Create Payout</h2>
            <div className="space-y-3">
              <select value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm">
                <option value="">Select store</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {(['periodStart', 'periodEnd'] as const).map(k => (
                <input key={k} type="date" placeholder={k} value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm" />
              ))}
              {(['grossRevenue', 'platformFeePercent', 'platformFee', 'netAmount'] as const).map(k => (
                <input key={k} type="number" placeholder={k.replace(/([A-Z])/g, ' $1')} value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm" />
              ))}
              <textarea placeholder="Notes (optional)" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm resize-none" rows={2} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-gray-700 text-white text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={createMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50">
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark paid modal */}
      {markingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMarkingId(null)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Mark as Paid</h2>
            <input type="text" placeholder="Reference / EFT number" value={markRef}
              onChange={e => setMarkRef(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setMarkingId(null)} className="flex-1 py-2 rounded-xl bg-gray-700 text-white text-sm">Cancel</button>
              <button onClick={() => markPaidMutation.mutate({ id: markingId, reference: markRef })}
                disabled={markPaidMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="text-gray-400 text-center py-12">Loading payouts…</div>}

      {!isLoading && !payouts.length && (
        <div className="text-gray-500 text-center py-12 bg-gray-800/40 rounded-2xl">No payouts yet.</div>
      )}

      {!isLoading && payouts.length > 0 && (
        <div className="bg-gray-800/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 gap-2 px-5 py-3 text-xs text-gray-500 font-semibold border-b border-gray-700">
            <span>Store</span><span>Period</span><span>Gross</span><span>Net</span><span>Status</span><span></span>
          </div>
          {payouts.map(p => (
            <div key={p.id} className="grid grid-cols-6 gap-2 px-5 py-3.5 border-b border-gray-700/60 items-center text-sm">
              <span className="text-white font-medium truncate">{p.tenant?.name ?? '—'}</span>
              <span className="text-gray-400 text-xs">
                {p.periodStart ? new Date(p.periodStart).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : '—'}
                {p.periodEnd ? ` – ${new Date(p.periodEnd).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: '2-digit' })}` : ''}
              </span>
              <span className="text-gray-300 font-numbers">{fmt(p.grossRevenue)}</span>
              <span className="text-green-400 font-numbers font-bold">{fmt(p.netAmount)}</span>
              <div>
                <StatusChip status={p.status} />
                {p.paidAt && <p className="text-[10px] text-gray-500 mt-0.5">{new Date(p.paidAt).toLocaleDateString('en-ZA')}</p>}
              </div>
              <div className="flex justify-end">
                {p.status === 'PENDING' && (
                  <button onClick={() => { setMarkingId(p.id); setMarkRef('') }}
                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                    <CheckCircle size={13} /> Mark Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
