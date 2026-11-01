import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useData } from '../lib/data'
import { entryTypeLabels } from '../lib/entryTypes'
import { evaluateAmount, typeColour, type EntryType } from '../lib/money'
import { AmountField } from './AmountPad'

/**
 * A new entry typed straight into the list, in place of a pop-up sheet, so the
 * screen doesn't jump when the keyboard opens. Return in the name opens the
 * amount keypad, where Done saves the row. Tapping anywhere outside the row and
 * keypad also saves it; a blank name discards it; an empty amount saves as £0.00.
 * Notes are added afterwards with Edit.
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
  const [padOpen, setPadOpen] = useState(false)
  const [error, setError] = useState('')
  const rowRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const saving = useRef(false)

  useEffect(() => {
    nameRef.current?.focus()
    rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  async function commit() {
    if (saving.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      onDone()
      return
    }
    const result = evaluateAmount(amount)
    if (result && !result.ok) {
      setError(result.error)
      setPadOpen(true)
      return
    }
    saving.current = true
    setPadOpen(false)
    try {
      await createEntry(budgetId, { name: trimmed, amount_pence: result?.pence ?? 0, type, note: '' })
      onDone()
    } catch {
      saving.current = false
      setError("Couldn't save. Press Save to try again.")
      setPadOpen(true)
    }
  }

  // Tapping anywhere outside the row and its keypad saves it.
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (rowRef.current?.contains(target) || target?.closest('[data-amount-pad]')) return
      void commitRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') onDone()
    if (event.key !== 'Enter') return
    event.preventDefault()
    // Closes the iPhone keyboard, and the app's keypad opens in its place.
    nameRef.current?.blur()
    setPadOpen(true)
  }

  function onAmountDone() {
    if (!name.trim()) {
      setPadOpen(false)
      setError('Enter a name')
      nameRef.current?.focus()
      return
    }
    void commit()
  }

  const colour = typeColour(type)
  const labels = entryTypeLabels[type]

  return (
    <div ref={rowRef} className="flex min-h-[68px] items-stretch border-b border-black/10 bg-surface">
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
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            onFocus={() => setPadOpen(false)}
            onKeyDown={onNameKeyDown}
            // 16px text stops iOS zooming in on focus.
            className={`min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted ${colour}`}
          />
          <AmountField
            label={labels.amount}
            placeholder={labels.amount === 'Amount' ? 'Enter amount' : labels.amount}
            value={amount}
            onChange={(text) => {
              setAmount(text)
              setError('')
            }}
            open={padOpen}
            onOpen={() => {
              nameRef.current?.blur()
              setPadOpen(true)
            }}
            onDone={onAmountDone}
            doneLabel="Save"
            className={`w-36 rounded-md px-1 py-1 text-right text-base font-semibold ${colour}`}
          />
        </div>
        {error && <p className="text-xs text-expense">{error}</p>}
      </div>
      <button
        type="button"
        aria-label="Cancel"
        onClick={onDone}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-black/10 text-xl text-muted"
      >
        ×
      </button>
    </div>
  )
}
