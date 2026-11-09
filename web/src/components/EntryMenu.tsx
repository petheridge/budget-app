import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/data'
import { isTracker, type Entry } from '../lib/pb'
import { budgetPath, linkTarget } from '../lib/selectors'
import { Menu } from './Menu'

/**
 * An entry's ⋮ menu. Name and amount are changed by tapping them in the list, so
 * there's no Edit: the note is the only thing left, and it's edited in place too.
 */
export function EntryMenu({
  entry,
  anchor,
  onClose,
  onEditNote,
}: {
  entry: Entry
  /** The ⋮ button the menu opens from. */
  anchor: HTMLElement
  onClose: () => void
  /** Opens the note for editing under the entry's name. */
  onEditNote: () => void
}) {
  const { deleteEntry, moveEntry, updateEntry, report, entries, budgets, folders } = useData()
  const navigate = useNavigate()
  const [step, setStep] = useState<'menu' | 'move'>('menu')
  const tracked = entry.type === 'saving' || entry.type === 'debt'
  const go = (to: string) => {
    onClose()
    navigate(to)
  }
  // An entry can only move to a budget of the same kind: a saving has no place in a monthly budget.
  const home = budgets.find((b) => b.id === entry.budget)
  const destinations = budgets
    .filter((b) => home && isTracker(b) === isTracker(home))
    .map((b) => ({ id: b.id, path: budgetPath(folders, b) }))
    .sort((a, b) => a.path.localeCompare(b.path))

  if (step === 'move') {
    const move = (budget: string) => {
      if (budget !== entry.budget) report('move the entry', moveEntry(entry.id, budget))
      onClose()
    }
    return (
      <Menu
        anchor={anchor}
        label={`Move ${entry.name} to budget`}
        title="Move to budget"
        onClose={onClose}
        items={destinations.map((d) => ({ label: d.path, checked: d.id === entry.budget, onSelect: () => move(d.id) }))}
      />
    )
  }

  return (
    <Menu
      anchor={anchor}
      label={`Options for ${entry.name}`}
      onClose={onClose}
      items={[
        ...(tracked ? [{ label: 'History', onSelect: () => go(`/entry/${entry.id}/history`) }] : []),
        ...(entry.type === 'expense'
          ? [
              {
                label: entry.paid ? 'Mark as unpaid' : 'Mark as paid',
                onSelect: () => {
                  onClose()
                  report('save that', updateEntry(entry.id, { paid: !entry.paid }))
                },
              },
              // Money going out of a budget into a saving or onto a debt.
              {
                label: linkTarget(entry, entries, budgets) ? 'Change link' : 'Link to saving or debt',
                onSelect: () => go(`/entry/${entry.id}/link`),
              },
            ]
          : []),
        {
          label: entry.note ? 'Edit note' : 'Add note',
          onSelect: () => {
            onClose()
            onEditNote()
          },
        },
        ...(destinations.length > 1 ? [{ label: 'Move to budget', onSelect: () => setStep('move') }] : []),
        // No confirm step: the delete can be undone for a few seconds.
        {
          label: 'Delete',
          danger: true,
          onSelect: () => {
            deleteEntry(entry.id)
            onClose()
          },
        },
      ]}
    />
  )
}
