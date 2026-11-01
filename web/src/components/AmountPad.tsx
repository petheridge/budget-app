import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { keyFromKeyboard, pressKey, spaceOperators, type PadKey } from '../lib/keypad'
import { evaluateAmount, formatUnsigned, isSum, penceToInput } from '../lib/money'

/**
 * An amount box that opens the app's own keypad instead of the iPhone keyboard,
 * so amounts can be sums ("12400 + 250", "1200 ÷ 12"). The keypad is part of the
 * page, so nothing jumps the way it does when the system keyboard opens.
 *
 * Controlled: the parent holds the text and whether this box's keypad is open.
 * Done works out the sum, puts the result in the box and calls onDone with it in
 * pence (null when empty). A problem keeps the keypad open with the reason shown.
 */
export function AmountField({
  value,
  onChange,
  open,
  onOpen,
  onDone,
  doneLabel = 'Done',
  placeholder,
  label,
  display,
  className = '',
}: {
  value: string
  onChange: (text: string) => void
  open: boolean
  onOpen: () => void
  onDone: (pence: number | null) => void
  doneLabel?: string
  placeholder: string
  label: string
  /** What the box shows while its keypad is closed, in place of the raw text. */
  display?: ReactNode
  className?: string
}) {
  const fieldRef = useRef<HTMLButtonElement>(null)
  // A saved value is "fresh" when the keypad opens: a digit replaces it, an operator adds to it.
  const [fresh, setFresh] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setFresh(true)
      setError('')
    }
  }, [open])

  function press(key: PadKey) {
    const next = pressKey({ text: value, fresh }, key)
    setFresh(next.fresh)
    setError('')
    onChange(next.text)
  }

  function done() {
    const result = evaluateAmount(value)
    if (result && !result.ok) {
      setError(result.error)
      return
    }
    const pence = result ? result.pence : null
    if (pence !== null) onChange(penceToInput(pence))
    onDone(pence)
  }

  return (
    <>
      <button
        ref={fieldRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={onOpen}
        className={`truncate tabular-nums ${open ? 'ring-2 ring-brand ring-inset' : ''} ${className}`}
      >
        {!open && display !== undefined ? (
          display
        ) : value ? (
          spaceOperators(value)
        ) : (
          <span className="font-normal text-muted">{placeholder}</span>
        )}
      </button>
      {open && (
        <AmountPad text={value} error={error} onKey={press} onDone={done} doneLabel={doneLabel} anchor={fieldRef} />
      )}
    </>
  )
}

const KEYS: { key: PadKey; label: ReactNode; name: string }[] = [
  { key: '7', label: '7', name: '7' },
  { key: '8', label: '8', name: '8' },
  { key: '9', label: '9', name: '9' },
  { key: '÷', label: '÷', name: 'divide' },
  { key: '4', label: '4', name: '4' },
  { key: '5', label: '5', name: '5' },
  { key: '6', label: '6', name: '6' },
  { key: '×', label: '×', name: 'times' },
  { key: '1', label: '1', name: '1' },
  { key: '2', label: '2', name: '2' },
  { key: '3', label: '3', name: '3' },
  { key: '−', label: '−', name: 'minus' },
  { key: '.', label: '.', name: 'point' },
  { key: '0', label: '0', name: '0' },
  { key: 'back', label: '⌫', name: 'delete' },
  { key: '+', label: '+', name: 'plus' },
]

/** The keypad itself, fixed to the bottom of the screen above everything else. */
function AmountPad({
  text,
  error,
  onKey,
  onDone,
  doneLabel,
  anchor,
}: {
  text: string
  error: string
  onKey: (key: PadKey) => void
  onDone: () => void
  doneLabel: string
  anchor: RefObject<HTMLElement | null>
}) {
  const padRef = useRef<HTMLDivElement>(null)

  // Make room to scroll the box being edited above the keypad, then do so if it's hidden.
  useLayoutEffect(() => {
    const pad = padRef.current
    const root = document.documentElement
    if (!pad) return
    root.style.setProperty('--amount-pad-height', `${pad.offsetHeight}px`)
    document.body.classList.add('amount-pad-open')
    const frame = requestAnimationFrame(() => {
      const field = anchor.current
      if (!field) return
      const overlap = field.getBoundingClientRect().bottom - pad.getBoundingClientRect().top + 12
      const scroller = field.closest<HTMLElement>('main, [role="dialog"]')
      if (overlap > 0 && scroller) scroller.scrollBy({ top: overlap, behavior: 'smooth' })
    })
    return () => {
      cancelAnimationFrame(frame)
      document.body.classList.remove('amount-pad-open')
    }
  }, [anchor])

  // Typing on a computer keyboard works too; Return or Enter is Done.
  const handlers = useRef({ onKey, onDone })
  handlers.current = { onKey, onDone }
  useEffect(() => {
    // The Return that opened the keypad (in a name box) is still on its way up to
    // window when this runs, and mustn't count as Done.
    const openedAt = performance.now()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.timeStamp < openedAt) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        handlers.current.onDone()
        return
      }
      const key = keyFromKeyboard(event.key)
      if (!key) return
      event.preventDefault()
      handlers.current.onKey(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const result = evaluateAmount(text)
  const preview = error ? (
    <span className="text-sm text-expense">{error}</span>
  ) : isSum(text) && result?.ok ? (
    <span className="text-muted">= {formatUnsigned(result.pence)}</span>
  ) : null

  return createPortal(
    <div
      ref={padRef}
      data-amount-pad
      role="group"
      aria-label="Amount keypad"
      className="fixed inset-x-0 bottom-0 z-50 bg-bg shadow-[0_-2px_8px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto max-w-[600px] px-2 pt-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="flex min-h-11 items-center justify-between gap-3 px-2 pb-1" aria-live="polite">
          <span className="min-w-0 truncate text-lg font-semibold text-text tabular-nums">
            {text ? spaceOperators(text) : '0'}
          </span>
          <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">{preview}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.map(({ key, label, name }) => {
            const operator = '+−×÷'.includes(key)
            return (
              <button
                key={key}
                type="button"
                aria-label={name}
                // Keeps focus where it is, so the row being edited doesn't think it was left.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey(key)}
                className={`h-12 touch-manipulation rounded-lg text-2xl font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.15)] active:brightness-90 ${operator ? 'bg-folder/60 text-brand' : 'bg-surface text-text'}`}
              >
                {label}
              </button>
            )
          })}
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onDone}
            className="col-span-4 h-12 touch-manipulation rounded-lg bg-brand text-lg font-bold text-white active:brightness-90"
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
