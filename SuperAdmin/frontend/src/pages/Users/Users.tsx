import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersService } from '../../services/users.service'
import type { UserDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { Search, Trash2, AlertTriangle, UserCog, Users as UsersIcon, AlertCircle } from 'lucide-react'

function roleVariant(role?: string): 'success' | 'info' | 'warning' | 'neutral' {
  switch ((role ?? '').toUpperCase()) {
    case 'ADMIN':   return 'warning'
    case 'MANAGER': return 'info'
    case 'USER':    return 'neutral'
    default:        return 'neutral'
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

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

export default function Users() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [deleteUser, setDeleteUser] = useState<UserDto | null>(null)
  const [roleUser, setRoleUser] = useState<UserDto | null>(null)
  const [newRole, setNewRole] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search, role, page],
    queryFn: () => usersService.getUsers({ search, role, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersService.updateUser(id, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setRoleUser(null) }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteUser(null) }
  })

  const columns = [
    {
      key: 'email',
      header: 'User',
      render: (row: UserDto) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-600">
            {getInitials(row.email)}
          </div>
          <span className="font-medium text-gray-900">{row.email}</span>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (row: UserDto) => <Badge label={row.role ?? '—'} variant={roleVariant(row.role)} />
    },
    {
      key: 'tenantName',
      header: 'Store',
      render: (row: UserDto) => <span className="text-gray-600 text-sm">{row.tenantName ?? '—'}</span>
    },
    {
      key: 'lastPing',
      header: 'Last Active',
      render: (row: UserDto) => (
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{timeAgo(row.lastPing?.toString())}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: UserDto) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setRoleUser(row); setNewRole(row.role ?? 'USER') }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Change Role">
            <UserCog size={15} />
          </button>
          <button onClick={() => setDeleteUser(row)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50"
            />
          </div>
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50"
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <UsersIcon size={15} />
          <span>{data?.total ?? 0} users</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Failed to load users — {(error as Error).message}</span>
        </div>
      )}

      <Table columns={columns as any} data={(data?.data ?? []) as any} loading={isLoading} />
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <Modal isOpen={!!roleUser} onClose={() => setRoleUser(null)} title="Change User Role" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Updating role for <strong>{roleUser?.email}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
              <option value="USER">USER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRoleUser(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => roleUser && updateMutation.mutate({ id: roleUser.id, role: newRole })} disabled={updateMutation.isPending} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60">
              {updateMutation.isPending ? 'Saving…' : 'Update Role'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Delete "{deleteUser?.email}"?</p>
              <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-60">
              {deleteMutation.isPending ? 'Deleting…' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
