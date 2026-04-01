type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

interface BadgeProps {
  label: string
  variant: Variant
}

const variantMap: Record<Variant, string> = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  danger:  'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-gray-700/50 text-gray-400 border-gray-700',
  info:    'bg-blue-500/10 text-blue-400 border-blue-500/20'
}

export default function Badge({ label, variant }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantMap[variant]}`}
    >
      {label}
    </span>
  )
}
