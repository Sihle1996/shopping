import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { driversService } from '../../services/drivers.service'
import { useToast } from '../../context/ToastContext'
import { useDebounce } from '../../hooks/useDebounce'
import type { UserDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { Search, ShieldOff, ShieldCheck, Truck, AlertCircle } from 'lucide-react'

function statusVariant(status?: string): 'success' | 'neutral' | 'warning' {
  switch ((status ?? '').toUpperCase()) {
    case 'AVAILABLE':   return 'success'
    case 'UNAVAILABLE': return 'warning'
    default:            return 'neutral'
  }
}

function timeAgo(iso?: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Drivers() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [confirmDriver, setConfirmDriver] = useState<{ driver: UserDto; newStatus: string } | null>(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, error } = useQuery({
    queryKey: ['drivers', debouncedSearch, status, page],
    queryFn: () => driversService.getDrivers({ search: debouncedSearch, status, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, driverStatus }: { id: string; driverStatus: string }) =>
      driversService.updateDriverStatus(id, driverStatus),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      setConfirmDriver(null)
      showToast(`Driver set to ${vars.driverStatus.toLowerCase()}`)
    },
    onError: (err: Error) => showToast(err.message || 'Failed to update driver status', 'error')
  })

  const columns = [
    {
      key: 'email',
      header: 'Driver',
      render: (row: UserDto) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Truck size={14} className="text-orange-400" />
          </div>
          <span className="font-medium text-gray-200">{row.email}</span>
        </div>
      )
    },
    {
      key: 'driverStatus',
      header: 'Status',
      render: (row: UserDto) => (
        <Badge label={row.driverStatus ?? 'UNKNOWN'} variant={statusVariant(row.driverStatus)} />
      )
    },
    {
      key: 'tenantName',
      header: 'Store',
      render: (row: UserDto) => <span className="text-gray-500">{row.tenantName ?? '—'}</span>
    },
    {
      key: 'lastPing',
      header: 'Last Active',
      render: (row: UserDto) => (
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-md">{timeAgo(row.lastPing?.toString())}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: UserDto) => {
        const isAvailable = (row.driverStatus ?? '').toUpperCase() === 'AVAILABLE'
        return (
          <button
            onClick={() => setConfirmDriver({ driver: row, newStatus: isAvailable ? 'UNAVAILABLE' : 'AVAILABLE' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isAvailable
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'
            }`}
          >
            {isAvailable ? <><ShieldOff size={13} /> Set Unavailable</> : <><ShieldCheck size={13} /> Set Available</>}
          </button>
        )
      }
    }
  ]

  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-800"
        style={{ background: '#161b22' }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              placeholder="Search drivers…"
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
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Truck size={15} />
          <span>{data?.total ?? 0} drivers</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Failed to load drivers — {(error as Error).message}</span>
        </div>
      )}

      <Table columns={columns as any} data={(data?.data ?? []) as any} loading={isLoading} />
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {confirmDriver && (
        <Modal isOpen={!!confirmDriver} onClose={() => setConfirmDriver(null)} title="Update Driver Status" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Set driver <strong className="text-gray-200">{confirmDriver.driver.email}</strong> to{' '}
              <strong className="text-gray-200">{confirmDriver.newStatus}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDriver(null)} className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
              <button
                onClick={() => statusMutation.mutate({ id: confirmDriver.driver.id, driverStatus: confirmDriver.newStatus })}
                disabled={statusMutation.isPending}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-60 ${
                  confirmDriver.newStatus === 'UNAVAILABLE' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {statusMutation.isPending ? 'Updating…' : `Set ${confirmDriver.newStatus}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
