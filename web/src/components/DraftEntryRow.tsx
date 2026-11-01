import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { useData } from '../lib/data'
import { entryTypeLabels } from '../lib/entryTypes'
import { parsePence, typeColour, type EntryType } from '../lib/money'

/**
 * A new entry typed straight into the list, in place of a pop-up sheet, so the
 * screen doesn't jump when the keyboard opens. Return in the name moves to the
 * amount. Leaving the row saves it; a blank name discards it; an empty amount
 * saves as £0.00. Notes are added afterwards with Edit.
 */
export function DraftEntryRow({
  budgetId,
  type,
  onDone,
}: {
  budgetId: string
  type: EntryType
  onDone: () => void
}) {
  const { createEntry } = useData()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const rowRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const saving = useRef(false)
  const cancelled = useRef(false)

  useEffect(() => {
    nameRef.current?.focus()
    rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  async function commit() {
    if (saving.current) return
    const trimmed = name.trim()
    if (!trimmed || cancelled.current) {
      onDone()
      return
    }
    const amount_pence = amount.trim() === '' ? 0 : parsePence(amount)
    if (amount_pence === null) {
      setError('Enter an amount, like 12.50')
      amountRef.current?.focus()
      return
    }
    saving.current = true
    try {
      await createEntry(budgetId, { name: trimmed, amount_pence, type, note: '' })
      onDone()
    } catch {
      saving.current = false
      setError("Couldn't save. Tap here to try again.")
    }
  }

  function onBlur(event: FocusEvent) {
    // Moving between the row's own fields isn't leaving it.
    if (rowRef.current?.contains(event.relatedTarget as Node | null)) return
    void commit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') onDone()
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (event.currentTarget === nameRef.current) amountRef.current?.focus()
    else event.currentTarget.blur()
  }

  const colour = typeColour(type)
  const labels = entryTypeLabels[type]
  // 16px text stops iOS zooming in on focus.
  const field = `min-w-0 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted ${colour}`

  return (
    <div
      ref={rowRef}
      onBlur={onBlur}
      className="flex min-h-[68px] items-stretch border-b border-black/10 bg-surface"
    >
      <div className="w-9 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2">
        <div className="flex items-center gap-2">
          <input
            ref={nameRef}
            aria-label={`${labels.noun} name`}
            placeholder={labels.example}
            enterKeyHint="next"
            autoCapitalize="sentences"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            className={`flex-1 ${field}`}
          />
          <input
            ref={amountRef}
            aria-label={labels.amount}
            placeholder={labels.amount === 'Amount' ? 'Enter amount' : labels.amount}
            inputMode="decimal"
            enterKeyHint="done"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError('')
            }}
            onKeyDown={onKeyDown}
            className={`w-32 text-right ${field}`}
          />
        </div>
        {error && (
          <button type="button" onClick={() => void commit()} className="text-left text-xs text-expense">
            {error}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Cancel"
        // Set before focus leaves the row, so tapping ✕ doesn't save on the way out.
        onPointerDown={() => (cancelled.current = true)}
        onClick={onDone}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-black/10 text-xl text-muted"
      >
        ×
      </button>
    </div>
  )
}
