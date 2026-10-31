import { useState } from 'react'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { EntrySheet } from './EntrySheet'
import { ActionSheet, ConfirmSheet } from './Sheet'

export function EntryMenu({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { deleteEntry } = useData()
  const [step, setStep] = useState<'menu' | 'edit' | 'delete'>('menu')

  if (step === 'edit') {
    return <EntrySheet budgetId={entry.budget} type={entry.type} entry={entry} onClose={onClose} />
  }
  if (step === 'delete') {
    return (
      <ConfirmSheet
        title={`Delete "${entry.name}"?`}
        message="This can't be undone."
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
        { label: 'Edit', onClick: () => setStep('edit') },
        { label: 'Delete', danger: true, onClick: () => setStep('delete') },
      ]}
    />
  )
}
