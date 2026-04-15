import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { platformSettingsService } from '../../services/platformSettings.service'
import { useToast } from '../../context/ToastContext'
import type { PlatformSettingsDto } from '../../types'
import { Settings2, AlertCircle } from 'lucide-react'

export default function Settings() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => platformSettingsService.getSettings()
  })

  const [form, setForm] = useState<Omit<PlatformSettingsDto, 'updatedAt'>>({
    commissionRatePercent: 4,
    supportEmail: '',
    defaultTrialDays: 14,
    allowSelfRegistration: true
  })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (data) {
      setForm({
        commissionRatePercent: data.commissionRatePercent,
        supportEmail: data.supportEmail,
        defaultTrialDays: data.defaultTrialDays,
        allowSelfRegistration: data.allowSelfRegistration
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (body: Omit<PlatformSettingsDto, 'updatedAt'>) =>
      platformSettingsService.updateSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] })
      showToast('Platform settings saved')
    },
    onError: () => showToast('Failed to save settings', 'error')
  })

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail?.trim() ?? '')

  const handleSave = () => {
    setSubmitted(true)
    if (!emailValid) return
    if (form.commissionRatePercent < 0 || form.commissionRatePercent > 100) return
    if (form.defaultTrialDays < 1 || form.defaultTrialDays > 365) return
    saveMutation.mutate(form)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent'
  const inputStyle = { background: '#0d1117' }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading settings…</div>
  )

  if (error) return (
    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
      <AlertCircle size={16} className="flex-shrink-0" />
      <span>Failed to load settings — {(error as Error).message}</span>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Settings2 size={20} className="text-orange-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-100">Platform Settings</h2>
          <p className="text-xs text-gray-500">Global configuration for the entire platform</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-gray-800 p-6 space-y-6" style={{ background: '#161b22' }}>

        {/* Commission */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Default Commission Rate (%)
          </label>
          <p className="text-xs text-gray-600 mb-2">
            Applied to stores that don't have a custom commission set.
          </p>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.commissionRatePercent}
            onChange={e => setForm(f => ({ ...f, commissionRatePercent: parseFloat(e.target.value) || 0 }))}
            className={`${inputCls} max-w-xs ${submitted && (form.commissionRatePercent < 0 || form.commissionRatePercent > 100) ? 'border-red-500' : 'border-gray-700'}`}
            style={inputStyle}
          />
          {submitted && (form.commissionRatePercent < 0 || form.commissionRatePercent > 100) && (
            <p className="text-xs text-red-400 mt-1">Must be between 0 and 100.</p>
          )}
        </div>

        {/* Support Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Platform Support Email
          </label>
          <p className="text-xs text-gray-600 mb-2">
            Shown to store owners and customers needing help.
          </p>
          <input
            type="email"
            value={form.supportEmail}
            onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))}
            placeholder="support@yourplatform.com"
            className={`${inputCls} ${submitted && !emailValid ? 'border-red-500' : 'border-gray-700'}`}
            style={inputStyle}
          />
          {submitted && !emailValid && (
            <p className="text-xs text-red-400 mt-1">Enter a valid email address.</p>
          )}
        </div>

        {/* Default Trial Days */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Default Trial Duration (days)
          </label>
          <p className="text-xs text-gray-600 mb-2">
            How long new stores get before their trial expires.
          </p>
          <input
            type="number"
            min={1}
            max={365}
            value={form.defaultTrialDays}
            onChange={e => setForm(f => ({ ...f, defaultTrialDays: parseInt(e.target.value) || 1 }))}
            className={`${inputCls} max-w-xs ${submitted && (form.defaultTrialDays < 1 || form.defaultTrialDays > 365) ? 'border-red-500' : 'border-gray-700'}`}
            style={inputStyle}
          />
          {submitted && (form.defaultTrialDays < 1 || form.defaultTrialDays > 365) && (
            <p className="text-xs text-red-400 mt-1">Must be between 1 and 365 days.</p>
          )}
        </div>

        {/* Self Registration Toggle */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Allow Self-Registration</p>
              <p className="text-xs text-gray-600 mt-0.5">
                When off, new stores can only be created by you from this panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, allowSelfRegistration: !f.allowSelfRegistration }))}
              className={[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                form.allowSelfRegistration ? 'bg-orange-500' : 'bg-gray-700'
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
                  form.allowSelfRegistration ? 'translate-x-5' : 'translate-x-0'
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        {/* Last updated */}
        {data?.updatedAt && (
          <p className="text-xs text-gray-600">
            Last saved: {new Date(data.updatedAt).toLocaleString('en-ZA')}
          </p>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60 transition-colors"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
