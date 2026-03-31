type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

interface BadgeProps {
  label: string
  variant: Variant
}

const variantMap: Record<Variant, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger:  'bg-red-100 text-red-700 border-red-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  info:    'bg-blue-100 text-blue-700 border-blue-200'
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
