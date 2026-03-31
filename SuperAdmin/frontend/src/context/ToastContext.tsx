import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium
              shadow-lg pointer-events-auto cursor-pointer select-none
              transition-all duration-300 max-w-sm
              ${t.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
              ${t.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400'     : ''}
              ${t.type === 'info'    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'   : ''}
            `}
            style={{ background: '#161b22' }}
          >
            <span className="flex-1">{t.message}</span>
            <span className="text-xs opacity-50">✕</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
