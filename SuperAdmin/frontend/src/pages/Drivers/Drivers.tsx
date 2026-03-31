import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { driversService } from '../../services/drivers.service'
import type { UserDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { Search, ShieldOff, ShieldCheck } from 'lucide-react'

function statusVariant(status?: string): 'success' | 'neutral' | 'danger' | 'warning' {
  switch ((status ?? '').toUpperCase()) {
    case 'AVAILABLE':   return 'success'
    case 'UNAVAILABLE': return 'warning'
    case 'SUSPENDED':   return 'danger'
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [confirmDriver, setConfirmDriver] = useState<{ driver: UserDto; newStatus: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', search, status, page],
    queryFn: () => driversService.getDrivers({ search, status, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, driverStatus }: { id: string; driverStatus: string }) =>
      driversService.updateDriverStatus(id, driverStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      setConfirmDriver(null)
    }
  })

  const columns = [
    {
      key: 'email',
      header: 'Email',
      render: (row: UserDto) => (
        <span className="font-medium text-gray-900">{row.email}</span>
      )
    },
    {
      key: 'driverStatus',
      header: 'Status',
      render: (row: UserDto) => (
        <Badge
          label={row.driverStatus ?? 'UNKNOWN'}
          variant={statusVariant(row.driverStatus)}
        />
      )
    },
    {
      key: 'tenantName',
      header: 'Store',
      render: (row: UserDto) => (
        <span className="text-gray-600">{row.tenantName ?? '—'}</span>
      )
    },
    {
      key: 'lastPing',
      header: 'Last Ping',
      render: (row: UserDto) => (
        <span className="text-gray-500 text-xs">{timeAgo(row.lastPing)}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: UserDto) => {
        const isSuspended = (row.driverStatus ?? '').toUpperCase() === 'SUSPENDED'
        return (
          <button
            onClick={() =>
              setConfirmDriver({
                driver: row,
                newStatus: isSuspended ? 'AVAILABLE' : 'SUSPENDED'
              })
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isSuspended
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {isSuspended ? (
              <><ShieldCheck size={13} /> Activate</>
            ) : (
              <><ShieldOff size={13} /> Suspend</>
            )}
          </button>
        )
      }
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
              placeholder="Search drivers…"
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
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} drivers</span>
      </div>

      {/* Table */}
      <Table
        columns={columns as any}
        data={(data?.data ?? []) as any}
        loading={isLoading}
      />

      <Pagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />

      {/* Confirm Status Change */}
      {confirmDriver && (
        <Modal
          isOpen={!!confirmDriver}
          onClose={() => setConfirmDriver(null)}
          title="Update Driver Status"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmDriver.newStatus === 'SUSPENDED'
                ? `Suspend driver `
                : `Activate driver `}
              <strong>{confirmDriver.driver.email}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDriver(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  statusMutation.mutate({
                    id: confirmDriver.driver.id,
                    driverStatus: confirmDriver.newStatus
                  })
                }
                disabled={statusMutation.isPending}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-60 ${
                  confirmDriver.newStatus === 'SUSPENDED'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {statusMutation.isPending
                  ? 'Updating…'
                  : confirmDriver.newStatus === 'SUSPENDED'
                  ? 'Suspend'
                  : 'Activate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
