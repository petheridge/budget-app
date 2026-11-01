import { useState } from 'react'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { linkTarget } from '../lib/selectors'
import { EntrySheet } from './EntrySheet'
import { HistorySheet } from './HistorySheet'
import { LinkSheet } from './LinkSheet'
import { ActionSheet, ConfirmSheet } from './Sheet'

export function EntryMenu({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { deleteEntry, entries, budgets } = useData()
  const [step, setStep] = useState<'menu' | 'edit' | 'delete' | 'history' | 'link'>('menu')
  const tracked = entry.type === 'saving' || entry.type === 'debt'

  if (step === 'edit') {
    return <EntrySheet budgetId={entry.budget} type={entry.type} entry={entry} onClose={onClose} />
  }
  if (step === 'history') return <HistorySheet entry={entry} onClose={onClose} />
  if (step === 'link') return <LinkSheet entry={entry} onClose={onClose} />
  if (step === 'delete') {
    return (
      <ConfirmSheet
        title={`Delete "${entry.name}"?`}
        message={tracked ? 'This also deletes its history, and can\'t be undone.' : "This can't be undone."}
        confirmLabel="Delete Entry"
        onConfirm={() => {
          deleteEntry(entry.id)
          onClose()
        }}
        onClose={onClose}
      />
    )
  }
  return (
    <ActionSheet
      title={entry.name}
      onClose={onClose}
      actions={[
        ...(tracked ? [{ label: 'History', onClick: () => setStep('history') }] : []),
        // Money going out of a budget into a saving or onto a debt.
        ...(entry.type === 'expense'
          ? [
              {
                label: linkTarget(entry, entries, budgets) ? 'Change link' : 'Link to saving or debt',
                onClick: () => setStep('link'),
              },
            ]
          : []),
        { label: 'Edit', onClick: () => setStep('edit') },
        { label: 'Delete', danger: true, onClick: () => setStep('delete') },
      ]}
    />
  )
}
