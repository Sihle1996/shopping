import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { storesService } from '../../services/stores.service'
import { subscriptionsService } from '../../services/subscriptions.service'
import { useToast } from '../../context/ToastContext'
import { useDebounce } from '../../hooks/useDebounce'
import type { TenantDto, UpdateStoreDto, CreateStoreDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { Search, Pencil, Trash2, Eye, EyeOff, AlertTriangle, Download, Plus } from 'lucide-react'
import { exportCsv } from '../../utils/exportCsv'

// ── helpers ────────────────────────────────────────────────────────────────
function planVariant(plan?: string) {
  if (!plan) return 'neutral' as const
  if (plan.toUpperCase() === 'ENTERPRISE') return 'info' as const
  if (plan.toUpperCase() === 'PRO') return 'info' as const
  return 'neutral' as const
}

function statusVariant(active: boolean): 'success' | 'danger' {
  return active ? 'success' : 'danger'
}

function subStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!status) return 'neutral'
  switch (status.toUpperCase()) {
    case 'ACTIVE': return 'success'
    case 'TRIAL':  return 'warning'
    case 'SUSPENDED': return 'danger'
    default: return 'neutral'
  }
}

// ── Create Modal ────────────────────────────────────────────────────────────
interface CreateStoreModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: CreateStoreDto) => void
  saving: boolean
  saveError?: string | null
}

function CreateStoreModal({ isOpen, onClose, onCreate, saving, saveError }: CreateStoreModalProps) {
  const [form, setForm] = useState<CreateStoreDto>({ name: '', slug: '', subscriptionPlan: 'BASIC', subscriptionStatus: 'TRIAL' })
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.getPlans(),
    staleTime: 5 * 60 * 1000
  })

  React.useEffect(() => {
    if (!isOpen) {
      setForm({ name: '', slug: '', subscriptionPlan: 'BASIC', subscriptionStatus: 'TRIAL' })
      setValidationError(null)
    }
  }, [isOpen])

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    setForm(f => ({ ...f, name, slug }))
  }

  const handleCreate = () => {
    if (!form.name.trim()) { setValidationError('Store name is required.'); return }
    if (!form.slug.trim()) { setValidationError('Slug is required.'); return }
    if (!/^[a-z0-9-]+$/.test(form.slug)) { setValidationError('Slug can only contain lowercase letters, numbers, and hyphens.'); return }
    setValidationError(null)
    onCreate(form)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const inputStyle = { background: '#0d1117' }
  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      {node}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Store" size="md">
      <div className="space-y-4">
        {field('Store Name *',
          <input
            type="text"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Joe's Burgers"
            className={inputCls}
            style={inputStyle}
          />
        )}
        {field('Slug *',
          <input
            type="text"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            placeholder="e.g. joes-burgers"
            className={inputCls}
            style={inputStyle}
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          {field('Email',
            <input
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="owner@example.com"
              className={inputCls}
              style={inputStyle}
            />
          )}
          {field('Phone',
            <input
              type="text"
              value={form.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+27 81 234 5678"
              className={inputCls}
              style={inputStyle}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('Subscription Plan',
            <select
              value={form.subscriptionPlan ?? 'BASIC'}
              onChange={e => setForm(f => ({ ...f, subscriptionPlan: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              {plans.length === 0 && <>
                <option value="BASIC">BASIC</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </>}
            </select>
          )}
          {field('Subscription Status',
            <select
              value={form.subscriptionStatus ?? 'TRIAL'}
              onChange={e => setForm(f => ({ ...f, subscriptionStatus: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              <option value="TRIAL">TRIAL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          )}
        </div>

        {(validationError || saveError) && (
          <p className="text-sm text-red-400">{validationError ?? saveError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create Store'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditStoreModalProps {
  store: TenantDto | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, data: UpdateStoreDto) => void
  saving: boolean
  saveError?: string | null
}

function EditStoreModal({ store, isOpen, onClose, onSave, saving, saveError }: EditStoreModalProps) {
  const [form, setForm] = useState<UpdateStoreDto>({})
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionsService.getPlans(),
    staleTime: 5 * 60 * 1000
  })

  React.useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        subscriptionPlan: store.subscriptionPlan ?? '',
        subscriptionStatus: store.subscriptionStatus ?? '',
        platformCommissionPercent: store.platformCommissionPercent,
        deliveryRadiusKm: store.deliveryRadiusKm,
        active: store.active
      })
      setValidationError(null)
    }
  }, [store])

  if (!store) return null

  const handleSave = () => {
    if (!form.name || form.name.trim().length === 0) {
      setValidationError('Store name is required.')
      return
    }
    const commission = form.platformCommissionPercent ?? 0
    if (commission < 0 || commission > 100) {
      setValidationError('Commission must be between 0 and 100.')
      return
    }
    const radius = form.deliveryRadiusKm ?? 0
    if (radius < 0 || radius > 500) {
      setValidationError('Delivery radius must be between 0 and 500 km.')
      return
    }
    setValidationError(null)
    onSave(store.id, form)
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      {node}
    </div>
  )

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const inputStyle = { background: '#0d1117' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Store — ${store.name}`} size="md">
      <div className="space-y-4">
        {field('Store Name',
          <input
            type="text"
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          />
        )}

        {field('Subscription Plan',
          <select
            value={form.subscriptionPlan ?? ''}
            onChange={e => setForm(f => ({ ...f, subscriptionPlan: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— Select plan —</option>
            {plans.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        )}

        {field('Subscription Status',
          <select
            value={form.subscriptionStatus ?? ''}
            onChange={e => setForm(f => ({ ...f, subscriptionStatus: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— Select status —</option>
            <option value="TRIAL">TRIAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        )}

        <div className="grid grid-cols-2 gap-4">
          {field('Commission %',
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.platformCommissionPercent ?? 0}
              onChange={e => setForm(f => ({ ...f, platformCommissionPercent: parseFloat(e.target.value) }))}
              className={inputCls}
              style={inputStyle}
            />
          )}
          {field('Delivery Radius (km)',
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.deliveryRadiusKm ?? 0}
              onChange={e => setForm(f => ({ ...f, deliveryRadiusKm: parseFloat(e.target.value) }))}
              className={inputCls}
              style={inputStyle}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            className={[
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              form.active ? 'bg-orange-500' : 'bg-gray-700'
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
                form.active ? 'translate-x-5' : 'translate-x-0'
              ].join(' ')}
            />
          </button>
          <span className="text-sm text-gray-400">Store Active</span>
        </div>

        {(validationError || saveError) && (
          <p className="text-sm text-red-400">{validationError ?? saveError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Stores() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [createOpen, setCreateOpen] = useState(false)
  const [editStore, setEditStore] = useState<TenantDto | null>(null)
  const [deleteStore, setDeleteStore] = useState<TenantDto | null>(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['stores', debouncedSearch, status, page],
    queryFn: () => storesService.getStores({ search: debouncedSearch, status, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateStoreDto) => storesService.createStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setCreateOpen(false)
      showToast('Store created successfully')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to create store', 'error')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStoreDto }) =>
      storesService.updateStore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setEditStore(null)
      showToast('Store updated successfully')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to update store', 'error')
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => storesService.toggleActive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storesService.deleteStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setDeleteStore(null)
      showToast('Store deleted')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to delete store', 'error')
  })

  const columns = [
    {
      key: 'name',
      header: 'Name / Slug',
      render: (row: TenantDto) => (
        <div>
          <p className="font-medium text-gray-200">{row.name}</p>
          <p className="text-xs text-gray-600 font-mono">{row.slug}</p>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: TenantDto) => (
        <span className="text-gray-400">{row.email ?? '—'}</span>
      )
    },
    {
      key: 'subscriptionPlan',
      header: 'Plan',
      render: (row: TenantDto) => (
        <Badge label={row.subscriptionPlan ?? 'None'} variant={planVariant(row.subscriptionPlan)} />
      )
    },
    {
      key: 'subscriptionStatus',
      header: 'Sub Status',
      render: (row: TenantDto) => (
        <Badge label={row.subscriptionStatus ?? 'N/A'} variant={subStatusVariant(row.subscriptionStatus)} />
      )
    },
    {
      key: 'active',
      header: 'Status',
      render: (row: TenantDto) => (
        <Badge label={row.active ? 'Active' : 'Inactive'} variant={statusVariant(row.active)} />
      )
    },
    {
      key: 'userCount',
      header: 'Users',
      render: (row: TenantDto) => <span className="text-gray-400">{row.userCount}</span>
    },
    {
      key: 'driverCount',
      header: 'Drivers',
      render: (row: TenantDto) => <span className="text-gray-400">{row.driverCount}</span>
    },
    {
      key: 'orderCount',
      header: 'Orders',
      render: (row: TenantDto) => <span className="text-gray-400">{row.orderCount.toLocaleString()}</span>
    },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (row: TenantDto) => (
        <span className="font-medium text-orange-400">R{row.revenue.toLocaleString()}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TenantDto) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditStore(row)}
            className="p-1.5 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => toggleMutation.mutate(row.id)}
            className={`p-1.5 rounded-md transition-colors ${
              row.active
                ? 'text-gray-600 hover:text-orange-400 hover:bg-orange-500/10'
                : 'text-gray-600 hover:text-green-400 hover:bg-green-500/10'
            }`}
            title={row.active ? 'Deactivate' : 'Activate'}
          >
            {row.active ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={() => setDeleteStore(row)}
            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-800"
        style={{ background: '#161b22' }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              placeholder="Search stores…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ background: '#0d1117' }}
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#0d1117' }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{data?.total ?? 0} stores</span>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors"
          >
            <Plus size={13} /> New Store
          </button>
          <button
            onClick={() => exportCsv('stores.csv', (data?.data ?? []).map(s => ({
              name: s.name,
              slug: s.slug,
              email: s.email ?? '',
              plan: s.subscriptionPlan ?? '',
              status: s.subscriptionStatus ?? '',
              active: s.active,
              users: s.userCount,
              drivers: s.driverCount,
              orders: s.orderCount,
              revenue: s.revenue
            })))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* TRIAL alert */}
      {(() => {
        const trialCount = (data?.data ?? []).filter(s => s.subscriptionStatus?.toUpperCase() === 'TRIAL').length
        return trialCount > 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{trialCount} store{trialCount > 1 ? 's' : ''} on TRIAL — consider following up on conversions.</span>
          </div>
        ) : null
      })()}

      {/* Table */}
      <Table
        columns={columns as any}
        data={(data?.data ?? []) as any}
        loading={isLoading}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />

      {/* Create Modal */}
      <CreateStoreModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(data) => createMutation.mutate(data)}
        saving={createMutation.isPending}
        saveError={createMutation.error ? (createMutation.error as Error).message : null}
      />

      {/* Edit Modal */}
      <EditStoreModal
        store={editStore}
        isOpen={!!editStore}
        onClose={() => setEditStore(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
        saving={updateMutation.isPending}
        saveError={updateMutation.error ? (updateMutation.error as Error).message : null}
      />

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteStore}
        onClose={() => setDeleteStore(null)}
        title="Delete Store"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                Delete "{deleteStore?.name}"?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone. All store data will be permanently removed.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteStore(null)}
              className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteStore && deleteMutation.mutate(deleteStore.id)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-60"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Store'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
