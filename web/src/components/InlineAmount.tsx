import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useData } from '../lib/data'
import { entryTypeLabels } from '../lib/entryTypes'
import { evaluateAmount, penceToInput } from '../lib/money'
import type { Entry } from '../lib/pb'
import { AmountField } from './AmountPad'

/**
 * An entry's amount in a list, which opens the keypad when tapped so it can be
 * changed in place. Done saves it, and so does tapping anywhere outside the
 * amount and keypad. For a saving or debt, a changed value is recorded in its
 * history, as with Edit.
 */
export function InlineAmount({
  entry,
  open,
  onOpen,
  onClose,
  children,
  className = '',
}: {
  entry: Entry
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** The amount as the list shows it while the keypad is closed. */
  children: ReactNode
  className?: string
}) {
  const { updateEntry } = useData()
  const [text, setText] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  async function save(pence: number | null) {
    onClose()
    const amount_pence = pence ?? 0
    if (amount_pence === entry.amount_pence) return
    await updateEntry(entry.id, { name: entry.name, amount_pence, type: entry.type, note: entry.note })
  }

  // Tapping anywhere outside the amount and its keypad saves it, like Done.
  const textRef = useRef(text)
  textRef.current = text
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (wrapperRef.current?.contains(target) || target?.closest('[data-amount-pad]')) return
      const result = evaluateAmount(textRef.current)
      // A sum that doesn't work out is left unsaved.
      if (result && !result.ok) onClose()
      else void saveRef.current(result ? result.pence : null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, onClose])

  return (
    <div ref={wrapperRef} className="shrink-0">
      <AmountField
        label={`${entry.name} ${entryTypeLabels[entry.type].amount.toLowerCase()}`}
        placeholder="0.00"
        value={text}
        onChange={setText}
        open={open}
        onOpen={() => {
          // Start from the saved value: a digit replaces it, + or − works from it.
          setText(penceToInput(entry.amount_pence))
          onOpen()
        }}
        onDone={(pence) => void save(pence)}
        display={children}
        className={`rounded-md px-1.5 py-1 text-right ${className}`}
      />
    </div>
  )
}
