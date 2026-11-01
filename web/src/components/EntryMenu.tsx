import { useState } from 'react'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { linkTarget } from '../lib/selectors'
import { EntrySheet } from './EntrySheet'
import { HistorySheet } from './HistorySheet'
import { LinkSheet } from './LinkSheet'
import { ActionSheet } from './Sheet'

export function EntryMenu({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { deleteEntry, entries, budgets } = useData()
  const [step, setStep] = useState<'menu' | 'edit' | 'history' | 'link'>('menu')
  const tracked = entry.type === 'saving' || entry.type === 'debt'

  if (step === 'edit') {
    return <EntrySheet budgetId={entry.budget} type={entry.type} entry={entry} onClose={onClose} />
  }
  if (step === 'history') return <HistorySheet entry={entry} onClose={onClose} />
  if (step === 'link') return <LinkSheet entry={entry} onClose={onClose} />
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
        // No confirm step: the delete can be undone for a few seconds.
        {
          label: 'Delete',
          danger: true,
          onClick: () => {
            deleteEntry(entry.id)
            onClose()
          },
        },
      ]}
    />
  )
}
