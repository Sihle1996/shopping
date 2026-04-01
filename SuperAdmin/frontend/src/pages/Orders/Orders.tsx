import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../../services/orders.service'
import { storesService } from '../../services/stores.service'
import { useDebounce } from '../../hooks/useDebounce'
import type { OrderDto } from '../../types'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import Pagination from '../../components/common/Pagination'
import { Search, ShoppingBag, AlertCircle, Download } from 'lucide-react'
import { exportCsv } from '../../utils/exportCsv'

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status.toUpperCase()) {
    case 'DELIVERED':  return 'success'
    case 'PENDING':    return 'warning'
    case 'CANCELLED':  return 'danger'
    case 'PREPARING':  return 'info'
    case 'OUT_FOR_DELIVERY': return 'info'
    default:           return 'neutral'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function Orders() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [storeId, setStoreId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const debouncedSearch = useDebounce(search)

  const { data: storesData } = useQuery({
    queryKey: ['stores-list'],
    queryFn: () => storesService.getStores({ pageSize: 100 }),
    staleTime: 5 * 60 * 1000
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', debouncedSearch, status, storeId, page],
    queryFn: () => ordersService.getOrders({ search: debouncedSearch, status, storeId, page, pageSize }),
    placeholderData: (prev) => prev
  })

  const columns = [
    {
      key: 'id',
      header: 'Order ID',
      render: (row: OrderDto) => (
        <span className="text-xs font-mono text-gray-500">{row.id.slice(0, 8).toUpperCase()}</span>
      )
    },
    {
      key: 'storeName',
      header: 'Store',
      render: (row: OrderDto) => (
        <span className="text-gray-300">{row.storeName}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: OrderDto) => (
        <Badge label={row.status} variant={statusVariant(row.status)} />
      )
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (row: OrderDto) => (
        <span className="font-medium text-orange-400">R{row.totalAmount.toFixed(2)}</span>
      )
    },
    {
      key: 'orderDate',
      header: 'Order Date',
      render: (row: OrderDto) => (
        <span className="text-sm text-gray-500">{formatDate(row.orderDate)}</span>
      )
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
              placeholder="Search orders…"
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
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PREPARING">Preparing</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={storeId}
            onChange={e => { setStoreId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ background: '#0d1117' }}
          >
            <option value="">All Stores</option>
            {storesData?.data.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ShoppingBag size={15} />
            <span>{data?.total ?? 0} orders</span>
          </div>
          <button
            onClick={() => exportCsv('orders.csv', (data?.data ?? []).map(o => ({
              id: o.id,
              store: o.storeName,
              status: o.status,
              amount: o.totalAmount.toFixed(2),
              date: new Date(o.orderDate).toISOString()
            })))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Failed to load orders — {(error as Error).message}</span>
        </div>
      )}

      <Table columns={columns as any} data={(data?.data ?? []) as any} loading={isLoading} />
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  )
}
