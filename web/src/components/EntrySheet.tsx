import { useState } from 'react'
import { useData } from '../lib/data'
import { entryTypeLabels } from '../lib/entryTypes'
import { evaluateAmount, penceToInput, type EntryType } from '../lib/money'
import { AmountField } from './AmountPad'
import type { Entry } from '../lib/pb'
import { FormSheet, inputClass } from './Sheet'

export function EntrySheet({
  budgetId,
  type,
  entry,
  onClose,
}: {
  budgetId: string
  type: EntryType
  entry?: Entry
  onClose: () => void
}) {
  const { createEntry, updateEntry } = useData()
  const [name, setName] = useState(entry?.name ?? '')
  const [amount, setAmount] = useState(entry ? penceToInput(entry.amount_pence) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [padOpen, setPadOpen] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const trimmed = name.trim()
    const result = evaluateAmount(amount)
    if (!trimmed) {
      setError('Please enter a name.')
      return
    }
    if (!result?.ok) {
      setError(result ? result.error : 'Please enter an amount, like 12.50.')
      return
    }
    const amount_pence = result.pence
    setPadOpen(false)
    setError('')
    const fields = { name: trimmed, amount_pence, type, note: note.trim() }
    if (entry) await updateEntry(entry.id, fields)
    else await createEntry(budgetId, fields)
    onClose()
  }

  const { noun, amount: amountLabel } = entryTypeLabels[type]

  return (
    <FormSheet
      title={`${entry ? 'Edit' : 'Add'} ${noun}`}
      onSave={save}
      onClose={onClose}
      error={error}
    >
      <label className="text-sm text-muted">
        Name
        <input
          className={inputClass}
          autoFocus
          value={name}
          onFocus={() => setPadOpen(false)}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="text-sm text-muted">
        {amountLabel}
        <div className="mt-1 flex items-center rounded-xl border border-black/10 bg-surface pl-3">
          <span className="text-base text-text">£</span>
          <AmountField
            label={amountLabel}
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
            open={padOpen}
            onOpen={() => {
              ;(document.activeElement as HTMLElement | null)?.blur()
              setPadOpen(true)
            }}
            onDone={() => setPadOpen(false)}
            className="flex-1 rounded-xl px-3 py-3 text-left text-base text-text"
          />
        </div>
      </div>
      <label className="text-sm text-muted">
        Note (optional)
        <input
          className={inputClass}
          value={note}
          onFocus={() => setPadOpen(false)}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </FormSheet>
  )
}
