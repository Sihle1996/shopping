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
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' }
}

export default function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const { bg, text } = colorMap[color]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={`${bg} ${text} rounded-lg p-3 flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
