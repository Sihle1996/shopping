import type { LucideIcon } from 'lucide-react'

type Color = 'blue' | 'green' | 'orange' | 'purple' | 'red'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color: Color
}

const colorMap: Record<Color, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  green:  { bg: 'bg-green-500/10',  text: 'text-green-400' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  red:    { bg: 'bg-red-500/10',    text: 'text-red-400' }
}

export default function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const { bg, text } = colorMap[color]

  return (
    <div
      className="rounded-xl border border-gray-800 p-5 flex items-start gap-4"
      style={{ background: '#161b22' }}
    >
      <div className={`${bg} ${text} rounded-lg p-3 flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
