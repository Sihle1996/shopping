import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0d1117' }}>
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
          <Zap size={28} className="text-orange-500" />
        </div>
        <p className="text-6xl font-bold text-gray-800 mb-2">404</p>
        <h2 className="text-lg font-semibold text-white mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
