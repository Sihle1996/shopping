import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enrollmentService } from '../../services/enrollment.service'
import { useToast } from '../../context/ToastContext'
import type { PendingEnrollmentDto, StoreDocumentDto } from '../../types'
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, ExternalLink, Clock, AlertTriangle } from 'lucide-react'

const DOC_LABELS: Record<string, string> = {
  CIPC: 'CIPC Registration Certificate',
  COA: 'Certificate of Acceptability',
  BANK_DETAILS: 'Bank Account / EFT Details',
  STOREFRONT_PHOTO: 'Storefront Photo',
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function getWaitingHours(submittedAt?: string | null): number {
  if (!submittedAt) return 0
  return (Date.now() - new Date(submittedAt).getTime()) / 3_600_000
}

function SlaChip({ submittedAt }: { submittedAt?: string | null }) {
  const hours = getWaitingHours(submittedAt)
  if (hours < 24)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{Math.round(hours)}h waiting</span>
  if (hours < 48)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-1"><AlertTriangle size={10} />{Math.round(hours)}h waiting</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 flex items-center gap-1"><AlertTriangle size={10} />Overdue — {Math.round(hours / 24)}d</span>
}

function DocumentRow({ doc }: { doc: StoreDocumentDto }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-800/60 text-sm">
      <FileText size={15} className="text-gray-400 flex-shrink-0" />
      <span className="flex-1 text-gray-200">{DOC_LABELS[doc.documentType] ?? doc.documentType}</span>
      <span className="text-gray-500 text-xs">{doc.fileName}</span>
      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
         className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-xs flex-shrink-0">
        View <ExternalLink size={11} />
      </a>
    </div>
  )
}

function EnrollmentRow({ store, onApprove, onReject, approving, rejecting }:
  { store: PendingEnrollmentDto; onApprove: () => void; onReject: (reason: string) => void; approving: boolean; rejecting: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-4">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate">{store.name}</p>
            <SlaChip submittedAt={store.submittedAt} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {store.email ?? '—'} &bull; {store.phone ?? '—'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <Clock size={11} /> Submitted {formatDate(store.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
            {store.documents.length} doc{store.documents.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => setExpanded(e => !e)}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          {/* Structured details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {store.cipcNumber && (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">CIPC Number</p>
                <p className="text-gray-200 font-medium">{store.cipcNumber}</p>
              </div>
            )}
            {store.bankName && (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">Bank</p>
                <p className="text-gray-200 font-medium">{store.bankName}</p>
              </div>
            )}
            {store.bankAccountNumber && (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">Account Number</p>
                <p className="text-gray-200 font-medium font-mono">{store.bankAccountNumber}</p>
              </div>
            )}
            {store.bankAccountType && (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">Account Type</p>
                <p className="text-gray-200 font-medium">{store.bankAccountType}</p>
              </div>
            )}
            {store.bankBranchCode && (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">Branch Code</p>
                <p className="text-gray-200 font-medium font-mono">{store.bankBranchCode}</p>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Documents</p>
            {store.documents.length === 0 ? (
              <p className="text-sm text-gray-600">No documents uploaded</p>
            ) : (
              store.documents.map(doc => <DocumentRow key={doc.id} doc={doc} />)
            )}
          </div>

          {/* Actions */}
          {!showRejectForm ? (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={onApprove} disabled={approving}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                <CheckCircle size={15} />
                {approving ? 'Approving…' : 'Approve'}
              </button>
              <button onClick={() => setShowRejectForm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold rounded-xl border border-red-600/30 transition-colors">
                <XCircle size={15} />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-300 font-medium">Rejection reason</p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain what the store owner needs to fix or provide…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 resize-none"
              />
              <div className="flex items-center gap-3">
                <button onClick={() => { onReject(rejectReason); setShowRejectForm(false) }}
                        disabled={rejecting || !rejectReason.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                  <XCircle size={15} />
                  {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                        className="px-4 py-2.5 text-gray-400 hover:text-gray-200 text-sm rounded-xl hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Enrollment() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)

  const { data: pending = [], isLoading, error } = useQuery({
    queryKey: ['enrollment-pending'],
    queryFn: () => enrollmentService.getPending(),
    staleTime: 30_000
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => enrollmentService.approve(id),
    onSuccess: (_, id) => {
      showToast('Store approved and activated', 'success')
      queryClient.setQueryData<PendingEnrollmentDto[]>(['enrollment-pending'], old =>
        (old ?? []).filter(s => s.id !== id))
      setActionId(null); setActionType(null)
    },
    onError: () => { showToast('Failed to approve store', 'error'); setActionId(null); setActionType(null) }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => enrollmentService.reject(id, reason),
    onSuccess: (_, { id }) => {
      showToast('Store rejected — owner notified', 'success')
      queryClient.setQueryData<PendingEnrollmentDto[]>(['enrollment-pending'], old =>
        (old ?? []).filter(s => s.id !== id))
      setActionId(null); setActionType(null)
    },
    onError: () => { showToast('Failed to reject store', 'error'); setActionId(null); setActionType(null) }
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Store Enrollments</h1>
        <p className="text-gray-500 text-sm">Review and approve new store applications</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to load pending enrollments
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && pending.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <p className="text-white font-semibold mb-1">All caught up</p>
          <p className="text-gray-500 text-sm">No stores are waiting for review</p>
        </div>
      )}

      {/* List */}
      {!isLoading && pending.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {pending.length} application{pending.length !== 1 ? 's' : ''} pending review
          </p>
          {pending.map(store => (
            <EnrollmentRow
              key={store.id}
              store={store}
              approving={actionId === store.id && actionType === 'approve' && approveMutation.isPending}
              rejecting={actionId === store.id && actionType === 'reject' && rejectMutation.isPending}
              onApprove={() => {
                setActionId(store.id); setActionType('approve')
                approveMutation.mutate(store.id)
              }}
              onReject={(reason) => {
                setActionId(store.id); setActionType('reject')
                rejectMutation.mutate({ id: store.id, reason })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
