import { useState } from 'react'
import { useData } from '../lib/data'
import { parsePence, penceToInput, type EntryType } from '../lib/money'
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
  const [error, setError] = useState('')

  async function save() {
    const trimmed = name.trim()
    const amount_pence = parsePence(amount)
    if (!trimmed) {
      setError('Please enter a name.')
      return
    }
    if (amount_pence === null) {
      setError('Please enter an amount, like 12.50.')
      return
    }
    setError('')
    const fields = { name: trimmed, amount_pence, type, note: note.trim() }
    if (entry) await updateEntry(entry.id, fields)
    else await createEntry(budgetId, fields)
    onClose()
  }

  const noun = type === 'income' ? 'Income' : 'Expense'

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
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="text-sm text-muted">
        Amount
        <span className="relative block">
          <span className="absolute top-1/2 left-3 mt-0.5 -translate-y-1/2 text-base text-text">
            £
          </span>
          <input
            className={`${inputClass} pl-7`}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </span>
      </label>
      <label className="text-sm text-muted">
        Note (optional)
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </FormSheet>
  )
}
