import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsService } from '../../services/subscriptions.service'
import { dashboardService } from '../../services/dashboard.service'
import { useToast } from '../../context/ToastContext'
import type { SubscriptionPlanDto, CreatePlanDto, UpdatePlanDto } from '../../types'
import Modal from '../../components/common/Modal'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  CreditCard,
  Zap,
  Star,
  Clock,
  TrendingUp,
  BarChart2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Plan icon map ───────────────────────────────────────────────────────────
const planIcon = (name: string) => {
  const n = name.toUpperCase()
  if (n === 'ENTERPRISE') return <Star size={20} className="text-purple-400" />
  if (n === 'PRO') return <Zap size={20} className="text-blue-400" />
  return <CreditCard size={20} className="text-gray-400" />
}

const planHeaderColor = (name: string) => {
  const n = name.toUpperCase()
  if (n === 'ENTERPRISE') return 'from-purple-600 to-purple-700'
  if (n === 'PRO') return 'from-blue-600 to-blue-700'
  return 'from-gray-700 to-gray-800'
}

// ── Plan Form ───────────────────────────────────────────────────────────────
interface PlanFormProps {
  initial?: Partial<CreatePlanDto>
  onSubmit: (data: CreatePlanDto) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
  serverError?: string | null
}

function PlanForm({ initial, onSubmit, onCancel, saving, submitLabel, serverError }: PlanFormProps) {
  const [form, setForm] = useState<CreatePlanDto>({
    name: initial?.name ?? '',
    price: initial?.price ?? 0,
    maxMenuItems: initial?.maxMenuItems ?? 0,
    maxDrivers: initial?.maxDrivers ?? 0,
    maxPromotions: initial?.maxPromotions ?? 3,
    maxDeliveryRadiusKm: initial?.maxDeliveryRadiusKm ?? 10,
    hasAnalytics: initial?.hasAnalytics ?? false,
    hasCustomBranding: initial?.hasCustomBranding ?? false,
    hasInventoryExport: initial?.hasInventoryExport ?? false,
    commissionPercent: initial?.commissionPercent ?? 4,
    features: initial?.features ?? ''
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!form.name.trim()) { setValidationError('Plan name is required.'); return }
    if (form.price < 0) { setValidationError('Price cannot be negative.'); return }
    if (form.maxMenuItems < 0) { setValidationError('Max menu items cannot be negative.'); return }
    if (form.maxDrivers < 0) { setValidationError('Max drivers cannot be negative.'); return }
    if (form.maxPromotions < 0) { setValidationError('Max promotions cannot be negative.'); return }
    if (form.commissionPercent < 0 || form.commissionPercent > 100) { setValidationError('Commission must be 0–100%.'); return }
    setValidationError(null)
    onSubmit(form)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const inputStyle = { background: '#0d1117' }

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
        value
          ? 'border-green-600 bg-green-900/30 text-green-400'
          : 'border-gray-700 bg-transparent text-gray-500'
      }`}
    >
      {value ? <Check size={14} /> : <X size={14} />}
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Plan Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. BASIC, PRO, ENTERPRISE"
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Price (ZAR/mo)</label>
          <input type="number" min={0} step={1} value={form.price}
            onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))}
            className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Commission %</label>
          <input type="number" min={0} max={100} step={0.5} value={form.commissionPercent}
            onChange={e => setForm(f => ({ ...f, commissionPercent: parseFloat(e.target.value) }))}
            className={inputCls} style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Max Menu Items</label>
          <input type="number" min={0} value={form.maxMenuItems}
            onChange={e => setForm(f => ({ ...f, maxMenuItems: parseInt(e.target.value) }))}
            className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Max Drivers</label>
          <input type="number" min={0} value={form.maxDrivers}
            onChange={e => setForm(f => ({ ...f, maxDrivers: parseInt(e.target.value) }))}
            className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Max Promotions</label>
          <input type="number" min={0} value={form.maxPromotions}
            onChange={e => setForm(f => ({ ...f, maxPromotions: parseInt(e.target.value) }))}
            className={inputCls} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Max Delivery Radius (km)</label>
        <input type="number" min={0} value={form.maxDeliveryRadiusKm}
          onChange={e => setForm(f => ({ ...f, maxDeliveryRadiusKm: parseInt(e.target.value) }))}
          className={inputCls} style={inputStyle} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Feature Access</label>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Analytics" value={form.hasAnalytics} onChange={v => setForm(f => ({ ...f, hasAnalytics: v }))} />
          <Toggle label="Custom Branding" value={form.hasCustomBranding} onChange={v => setForm(f => ({ ...f, hasCustomBranding: v }))} />
          <Toggle label="Inventory Export" value={form.hasInventoryExport} onChange={v => setForm(f => ({ ...f, hasInventoryExport: v }))} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Features <span className="text-gray-600">(comma-separated, shown on card)</span>
        </label>
        <textarea rows={2} value={form.features ?? ''}
          onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
          placeholder="e.g. Priority support, White-label, Dedicated onboarding"
          className={`${inputCls} resize-none`} style={inputStyle} />
      </div>

      {(validationError || serverError) && (
        <p className="text-sm text-red-400">{validationError ?? serverError}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

// ── Plan Card ───────────────────────────────────────────────────────────────
interface PlanCardProps {
  plan: SubscriptionPlanDto
  onEdit: (plan: SubscriptionPlanDto) => void
  onDelete: (plan: SubscriptionPlanDto) => void
}

function PlanCard({ plan, onEdit, onDelete }: PlanCardProps) {
  const features = plan.features
    ? plan.features.split(',').map(f => f.trim()).filter(Boolean)
    : []

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden flex flex-col" style={{ background: '#161b22' }}>
      {/* Card header */}
      <div className={`bg-gradient-to-br ${planHeaderColor(plan.name)} px-5 py-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="bg-white/20 rounded-lg p-2">{planIcon(plan.name)}</div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(plan)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md text-white transition-colors" title="Edit plan">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(plan)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md text-white transition-colors" title="Delete plan">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
        <p className="text-white/80 text-2xl font-bold mt-1">
          R{plan.price.toLocaleString()}<span className="text-sm font-normal text-white/60">/mo</span>
        </p>
        <p className="text-white/60 text-xs mt-1">{plan.commissionPercent}% platform commission</p>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 flex-1">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-800/60 rounded-lg p-2 text-center border border-gray-800">
            <p className="text-xs text-gray-600">Items</p>
            <p className="text-base font-bold text-gray-200">{plan.maxMenuItems === 999 ? '∞' : plan.maxMenuItems}</p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center border border-gray-800">
            <p className="text-xs text-gray-600">Drivers</p>
            <p className="text-base font-bold text-gray-200">{plan.maxDrivers === 999 ? '∞' : plan.maxDrivers}</p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center border border-gray-800">
            <p className="text-xs text-gray-600">Promos</p>
            <p className="text-base font-bold text-gray-200">{plan.maxPromotions === 999 ? '∞' : plan.maxPromotions}</p>
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          {[
            { label: 'Analytics', value: plan.hasAnalytics },
            { label: 'Custom Branding', value: plan.hasCustomBranding },
            { label: 'Inventory Export', value: plan.hasInventoryExport },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              {value
                ? <Check size={13} className="text-green-400 flex-shrink-0" />
                : <X size={13} className="text-gray-700 flex-shrink-0" />}
              <span className={value ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Check size={13} className="text-green-400 flex-shrink-0" />
            {plan.maxDeliveryRadiusKm} km delivery radius
          </div>
        </div>

        {features.length > 0 && (
          <ul className="space-y-1">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                <Check size={12} className="text-green-500 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-gray-700">Created {new Date(plan.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [editPlan, setEditPlan] = useState<SubscriptionPlanDto | null>(null)
  const [deletePlan, setDeletePlan] = useState<SubscriptionPlanDto | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: subscriptionsService.getPlans
  })

  const { data: health } = useQuery({
    queryKey: ['subscription-health'],
    queryFn: dashboardService.getSubscriptionHealth,
    refetchInterval: 60_000
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePlanDto) => subscriptionsService.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setShowCreate(false)
      showToast('Plan created successfully')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanDto }) =>
      subscriptionsService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setEditPlan(null)
      showToast('Plan updated successfully')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsService.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setDeletePlan(null)
      showToast('Plan deleted')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to delete plan', 'error')
  })

  const extendMutation = useMutation({
    mutationFn: (tenantId: string) => subscriptionsService.extendTrial(tenantId, 7),
    onSuccess: (_data, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-health'] })
      setExtendingId(null)
      const trial = health?.expiringTrials.find(t => t.id === tenantId)
      showToast(`Trial extended by 7 days${trial ? ` for ${trial.name}` : ''}`)
    },
    onError: () => {
      setExtendingId(null)
      showToast('Failed to extend trial', 'error')
    }
  })

  const handleExtend = (tenantId: string) => {
    setExtendingId(tenantId)
    extendMutation.mutate(tenantId)
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-200">Subscription Plans</h2>
          <p className="text-sm text-gray-600 mt-0.5">Manage plans assigned to stores on the platform</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create New Plan
        </button>
      </div>

      {/* Plan grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 h-64 animate-pulse" style={{ background: '#161b22' }}>
              <div className="h-32 bg-gray-800 rounded-t-xl" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-gray-800 rounded w-2/3" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-gray-800 p-12 text-center" style={{ background: '#161b22' }}>
          <CreditCard size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No plans created yet</p>
          <p className="text-sm text-gray-600 mt-1">Click "Create New Plan" to add a subscription plan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={setEditPlan} onDelete={setDeletePlan} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Plan" size="md">
        <PlanForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={createMutation.isPending}
          submitLabel="Create Plan"
          serverError={createMutation.error ? (createMutation.error as Error).message : null}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editPlan} onClose={() => setEditPlan(null)} title={`Edit Plan — ${editPlan?.name}`} size="md">
        {editPlan && (
          <PlanForm
            initial={{
              name: editPlan.name,
              price: editPlan.price,
              maxMenuItems: editPlan.maxMenuItems,
              maxDrivers: editPlan.maxDrivers,
              maxPromotions: editPlan.maxPromotions,
              maxDeliveryRadiusKm: editPlan.maxDeliveryRadiusKm,
              hasAnalytics: editPlan.hasAnalytics,
              hasCustomBranding: editPlan.hasCustomBranding,
              hasInventoryExport: editPlan.hasInventoryExport,
              commissionPercent: editPlan.commissionPercent,
              features: editPlan.features
            }}
            onSubmit={(data) => updateMutation.mutate({ id: editPlan.id, data })}
            onCancel={() => setEditPlan(null)}
            saving={updateMutation.isPending}
            submitLabel="Save Changes"
            serverError={updateMutation.error ? (updateMutation.error as Error).message : null}
          />
        )}
      </Modal>

      {/* ── Subscription Health ────────────────────────────────────────────── */}
      {health && (
        <div className="mt-8 space-y-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Platform Health</h3>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Revenue forecast */}
            <div className="rounded-xl border border-gray-800 p-5" style={{ background: '#161b22' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-green-900/40 rounded-lg flex items-center justify-center">
                  <TrendingUp size={16} className="text-green-400" />
                </div>
                <p className="text-xs text-gray-500">Monthly Revenue Forecast</p>
              </div>
              <p className="text-2xl font-bold text-gray-200 mt-2">
                R{health.monthlyRevenueForecast.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600 mt-1">From active paying stores</p>
            </div>

            {/* Expiring trials count */}
            <div className="rounded-xl border border-gray-800 p-5" style={{ background: '#161b22' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-yellow-900/40 rounded-lg flex items-center justify-center">
                  <Clock size={16} className="text-yellow-400" />
                </div>
                <p className="text-xs text-gray-500">Trials Expiring Within 7 Days</p>
              </div>
              <p className="text-2xl font-bold text-gray-200 mt-2">{health.expiringTrials.length}</p>
              <p className="text-xs text-gray-600 mt-1">Require follow-up</p>
            </div>
          </div>

          {/* Expiring trials list */}
          {health.expiringTrials.length > 0 && (
            <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: '#161b22' }}>
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <AlertTriangle size={15} className="text-yellow-400" />
                <span className="text-sm font-medium text-gray-300">Expiring Trials</span>
              </div>
              <div className="divide-y divide-gray-800">
                {health.expiringTrials.map(t => (
                  <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-300 font-medium truncate">{t.name}</p>
                      {t.email && <p className="text-xs text-gray-600 truncate">{t.email}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        t.daysRemaining <= 2 ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'
                      }`}>
                        {t.daysRemaining === 0 ? 'Expires today' : `${t.daysRemaining}d left`}
                      </span>
                      <button
                        onClick={() => handleExtend(t.id)}
                        disabled={extendingId === t.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-yellow-700/50 text-yellow-500 hover:bg-yellow-900/30 transition-colors disabled:opacity-40"
                      >
                        {extendingId === t.id ? '…' : '+7d'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan distribution chart */}
          {health.planDistribution.length > 0 && (
            <div className="rounded-xl border border-gray-800 p-5" style={{ background: '#161b22' }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-300">Plan Distribution</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={health.planDistribution} barSize={32}>
                  <XAxis dataKey="plan" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {health.planDistribution.map((entry, idx) => {
                      const colors = ['#4b5563', '#3b82f6', '#a855f7']
                      return <Cell key={idx} fill={colors[idx % colors.length]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deletePlan} onClose={() => setDeletePlan(null)} title="Delete Plan" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Delete "{deletePlan?.name}" plan?</p>
              <p className="text-sm text-gray-500 mt-1">
                Stores assigned to this plan may be affected. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeletePlan(null)}
              className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => deletePlan && deleteMutation.mutate(deletePlan.id)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-60">
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Plan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
