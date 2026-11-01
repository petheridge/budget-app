import { formatUnsigned } from '../lib/money'

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "1 Oct", with the year added when it isn't this year (or always, when asked). */
export function formatDay(iso: string, withYear = false): string {
  // PocketBase dates look like "2026-10-01 12:00:00.000Z".
  const date = new Date(iso.replace(' ', 'T'))
  const showYear = withYear || date.getFullYear() !== new Date().getFullYear()
  return (showYear ? dayMonthYear : dayMonth).format(date)
}

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
