import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { entryTypeLabels } from '../lib/entryTypes'
import { formatUnsigned, typeColour, type EntryType } from '../lib/money'
import { PlusCircleIcon } from './icons'
import { usePulse } from './usePulse'

/**
 * The total a budget's screen is about (its balance, or net worth), big at the
 * top, with a quiet line of the figures behind it underneath.
 */
export function Hero({
  label,
  amount,
  colour,
  detail,
  amountRef,
}: {
  label: string
  amount: string
  colour: string
  /** Only for a budget with both kinds of entry; otherwise it would just repeat the total. */
  detail?: ReactNode
  amountRef: RefObject<HTMLParagraphElement | null>
}) {
  usePulse(amount, amountRef)
  return (
    <div className="px-4 pt-6 pb-1 text-center">
      <p className="text-sm text-muted">{label}</p>
      <p ref={amountRef} className={`text-4xl font-bold whitespace-nowrap ${colour}`}>
        {amount}
      </p>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
    </div>
  )
}

/** "Income £ 3,200.00", for a Hero's line of detail. */
export function HeroPart({ type, total }: { type: EntryType; total: number }) {
  return (
    <span className="whitespace-nowrap">
      {entryTypeLabels[type].plural} <span className={`font-semibold ${typeColour(type)}`}>{formatUnsigned(total)}</span>
    </span>
  )
}

/**
 * True once the hero's amount has scrolled out of sight, so the header can show
 * it instead, as iOS large titles shrink into the bar.
 */
export function useScrolledPast(ref: RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Measured against the screen, allowing for the list's clipping under the header.
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return past
}

/**
 * A screen title with the hero's amount under it, once that has scrolled away.
 * The amount rises into view through a mask as the title moves up to make room
 * (`.header-amount` in index.css), and goes the same way.
 */
export function TitleWithAmount({ title, amount }: { title: ReactNode; amount: string | null }) {
  // Kept while it leaves, so it doesn't vanish before it has moved out of sight.
  const last = useRef(amount)
  if (amount !== null) last.current = amount
  const shown = amount ?? last.current
  return (
    <span className="flex min-w-0 flex-col items-center leading-tight">
      {title}
      {shown !== null && (
        <span className="header-amount" data-shown={amount !== null || undefined} aria-hidden={amount === null || undefined}>
          <span>
            <span className="text-xs font-semibold whitespace-nowrap opacity-90">{shown}</span>
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * One kind of entry (income, expenses, savings or debts) as a rounded section, as
 * in iOS Settings: a heading with its subtotal, the rows, then a row to add one,
 * which starts a new row typed in place at the end.
 */
export function EntrySection({
  type,
  total,
  onAdd,
  children,
}: {
  type: EntryType
  total: number
  onAdd: () => void
  children: ReactNode
}) {
  const { noun, plural } = entryTypeLabels[type]
  const colour = typeColour(type)
  return (
    <section aria-label={plural} className="pt-5">
      <div className="flex items-baseline justify-between px-5 pb-1.5">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{plural}</h2>
        <span className={`text-sm font-semibold whitespace-nowrap ${colour}`}>{formatUnsigned(total)}</span>
      </div>
      <div className="mx-3 overflow-hidden rounded-xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        {children}
        <button
          type="button"
          onClick={onAdd}
          className={`flex min-h-12 w-full items-center gap-2 px-4 text-left font-semibold active:bg-bg ${colour}`}
        >
          <PlusCircleIcon />
          Add {noun.toLowerCase()}
        </button>
      </div>
    </section>
  )
}

/** For a screen's hero amount: a ref to watch, and whether it's scrolled away. */
export function useHero() {
  const amountRef = useRef<HTMLParagraphElement>(null)
  return { amountRef, scrolledPast: useScrolledPast(amountRef) }
}

/**
 * Small "⊕ Add income" links for the kinds of entry a budget has none of, so a
 * budget used for just outgoings (or just income) isn't cluttered with an empty
 * section, while adding the other kind is still a tap away.
 */
export function AddLinks({ types, onAdd }: { types: EntryType[]; onAdd: (type: EntryType) => void }) {
  if (types.length === 0) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 px-4 pt-5">
      {types.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onAdd(type)}
          className={`press flex min-h-11 items-center gap-1.5 text-sm font-semibold ${typeColour(type)}`}
        >
          <PlusCircleIcon />
          Add {entryTypeLabels[type].noun.toLowerCase()}
        </button>
      ))}
    </div>
  )
}
