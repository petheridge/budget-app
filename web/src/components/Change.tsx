import { formatUnsigned } from '../lib/money'

export { formatDay } from '../lib/dates'

/** "▲ £ 250.00", green when the change is good for this item, red-orange when not. */
export function ChangeText({
  change,
  good,
  suffix = '',
}: {
  change: number
  good: boolean
  suffix?: string
}) {
  if (change === 0) return <span className="text-xs text-muted">No change{suffix}</span>
  return (
    <span className={`text-xs font-medium ${good ? 'text-income' : 'text-expense'}`}>
      {change > 0 ? '▲' : '▼'} {formatUnsigned(change)}
      {suffix}
    </span>
  )
}
