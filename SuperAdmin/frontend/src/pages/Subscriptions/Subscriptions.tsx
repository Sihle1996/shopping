import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsService } from '../../services/subscriptions.service'
import { useToast } from '../../context/ToastContext'
import type { SubscriptionPlanDto, CreatePlanDto, UpdatePlanDto } from '../../types'
import Modal from '../../components/common/Modal'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  CreditCard,
  Zap,
  Star
} from 'lucide-react'

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
    features: initial?.features ?? ''
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setValidationError('Plan name is required.')
      return
    }
    if (form.price < 0) {
      setValidationError('Price cannot be negative.')
      return
    }
    if (form.maxMenuItems < 0) {
      setValidationError('Max menu items cannot be negative.')
      return
    }
    if (form.maxDrivers < 0) {
      setValidationError('Max drivers cannot be negative.')
      return
    }
    setValidationError(null)
    onSubmit(form)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const inputStyle = { background: '#0d1117' }

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
          <input
            type="number"
            min={0}
            step={1}
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Max Menu Items</label>
          <input
            type="number"
            min={0}
            value={form.maxMenuItems}
            onChange={e => setForm(f => ({ ...f, maxMenuItems: parseInt(e.target.value) }))}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Max Drivers</label>
        <input
          type="number"
          min={0}
          value={form.maxDrivers}
          onChange={e => setForm(f => ({ ...f, maxDrivers: parseInt(e.target.value) }))}
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Features <span className="text-gray-600">(comma-separated)</span>
        </label>
        <textarea
          rows={3}
          value={form.features ?? ''}
          onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
          placeholder="e.g. Analytics dashboard, Priority support, Custom branding"
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
      </div>

      {(validationError || serverError) && (
        <p className="text-sm text-red-400">{validationError ?? serverError}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60"
        >
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
    <div
      className="rounded-xl border border-gray-800 overflow-hidden flex flex-col"
      style={{ background: '#161b22' }}
    >
      {/* Card header */}
      <div className={`bg-gradient-to-br ${planHeaderColor(plan.name)} px-5 py-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="bg-white/20 rounded-lg p-2">
            {planIcon(plan.name)}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(plan)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md text-white transition-colors"
              title="Edit plan"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md text-white transition-colors"
              title="Delete plan"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
        <p className="text-white/80 text-2xl font-bold mt-1">
          R{plan.price.toLocaleString()}
          <span className="text-sm font-normal text-white/60">/mo</span>
        </p>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 flex-1">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-800">
            <p className="text-xs text-gray-600">Menu Items</p>
            <p className="text-lg font-bold text-gray-200">{plan.maxMenuItems}</p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-800">
            <p className="text-xs text-gray-600">Drivers</p>
            <p className="text-lg font-bold text-gray-200">{plan.maxDrivers}</p>
          </div>
        </div>

        {features.length > 0 && (
          <ul className="space-y-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <Check size={14} className="text-green-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        )}

        {features.length === 0 && (
          <p className="text-xs text-gray-600 italic">No features listed</p>
        )}
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-gray-700">
          Created {new Date(plan.createdAt).toLocaleDateString()}
        </p>
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

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: subscriptionsService.getPlans
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

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-200">Subscription Plans</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Manage plans assigned to stores on the platform
          </p>
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
          <p className="text-sm text-gray-600 mt-1">
            Click "Create New Plan" to add a subscription plan
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={setEditPlan}
              onDelete={setDeletePlan}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Plan"
        size="md"
      >
        <PlanForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={createMutation.isPending}
          submitLabel="Create Plan"
          serverError={createMutation.error ? (createMutation.error as Error).message : null}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editPlan}
        onClose={() => setEditPlan(null)}
        title={`Edit Plan — ${editPlan?.name}`}
        size="md"
      >
        {editPlan && (
          <PlanForm
            initial={{
              name: editPlan.name,
              price: editPlan.price,
              maxMenuItems: editPlan.maxMenuItems,
              maxDrivers: editPlan.maxDrivers,
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

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        title="Delete Plan"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                Delete "{deletePlan?.name}" plan?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Stores assigned to this plan may be affected. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeletePlan(null)}
              className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deletePlan && deleteMutation.mutate(deletePlan.id)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-60"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Plan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
