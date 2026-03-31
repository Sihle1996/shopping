import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { storesService } from '../../services/stores.service'
import { subscriptionsService } from '../../services/subscriptions.service'
import type { TenantDto, UpdateStoreDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { Search, Pencil, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'

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

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditStoreModalProps {
  store: TenantDto | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, data: UpdateStoreDto) => void
  saving: boolean
}

function EditStoreModal({ store, isOpen, onClose, onSave, saving }: EditStoreModalProps) {
  const [form, setForm] = useState<UpdateStoreDto>({})

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
    }
  }, [store])

  if (!store) return null

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {node}
    </div>
  )

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const selectCls = inputCls

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Store — ${store.name}`} size="md">
      <div className="space-y-4">
        {field('Store Name',
          <input
            type="text"
            value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
        )}

        {field('Subscription Plan',
          <select
            value={form.subscriptionPlan ?? ''}
            onChange={e => setForm(f => ({ ...f, subscriptionPlan: e.target.value }))}
            className={selectCls}
          >
            <option value="">— Select plan —</option>
            <option value="BASIC">BASIC</option>
            <option value="PRO">PRO</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
        )}

        {field('Subscription Status',
          <select
            value={form.subscriptionStatus ?? ''}
            onChange={e => setForm(f => ({ ...f, subscriptionStatus: e.target.value }))}
            className={selectCls}
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
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            className={[
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              form.active ? 'bg-orange-500' : 'bg-gray-200'
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
                form.active ? 'translate-x-5' : 'translate-x-0'
              ].join(' ')}
            />
          </button>
          <span className="text-sm text-gray-700">Store Active</span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(store.id, form)}
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [editStore, setEditStore] = useState<TenantDto | null>(null)
  const [deleteStore, setDeleteStore] = useState<TenantDto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stores', search, status, page],
    queryFn: () => storesService.getStores({ search, status, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStoreDto }) =>
      storesService.updateStore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setEditStore(null)
    }
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
    }
  })

  const columns = [
    {
      key: 'name',
      header: 'Name / Slug',
      render: (row: TenantDto) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400 font-mono">{row.slug}</p>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: TenantDto) => (
        <span className="text-gray-600">{row.email ?? '—'}</span>
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
      render: (row: TenantDto) => <span className="text-gray-700">{row.userCount}</span>
    },
    {
      key: 'driverCount',
      header: 'Drivers',
      render: (row: TenantDto) => <span className="text-gray-700">{row.driverCount}</span>
    },
    {
      key: 'orderCount',
      header: 'Orders',
      render: (row: TenantDto) => <span className="text-gray-700">{row.orderCount.toLocaleString()}</span>
    },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (row: TenantDto) => (
        <span className="font-medium text-gray-900">R{row.revenue.toLocaleString()}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TenantDto) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditStore(row)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => toggleMutation.mutate(row.id)}
            className={`p-1.5 rounded-md transition-colors ${
              row.active
                ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title={row.active ? 'Deactivate' : 'Activate'}
          >
            {row.active ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={() => setDeleteStore(row)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search stores…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {data?.total ?? 0} stores
        </span>
      </div>

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

      {/* Edit Modal */}
      <EditStoreModal
        store={editStore}
        isOpen={!!editStore}
        onClose={() => setEditStore(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
        saving={updateMutation.isPending}
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
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
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
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
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
