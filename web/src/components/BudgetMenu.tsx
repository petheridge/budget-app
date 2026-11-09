import { useState } from 'react'
import { csvFileName, exportRows, saveFile, toCsv } from '../lib/csv'
import { useData } from '../lib/data'
import { isTracker, type Budget } from '../lib/pb'
import { entriesIn, folderPath, sortByAmount } from '../lib/selectors'
import { Menu } from './Menu'

export function BudgetMenu({
  budget,
  anchor,
  onClose,
  onRename,
  onDuplicated,
  onBeforeDelete,
}: {
  budget: Budget
  /** The button the menu opens from. */
  anchor: HTMLElement
  onClose: () => void
  /** Rename is done in place, by whatever shows the name. */
  onRename: () => void
  /** Given the copy's id once it exists, to show it with its name ready to change. */
  onDuplicated?: (id: string) => void
  onBeforeDelete?: () => void
}) {
  const { deleteBudget, duplicateBudget, setBudgetKind, moveBudget, report, budgets, entries, folders, snapshots, reorderEntries } =
    useData()
  // A budget's type can only change while it's empty, so no entry has the wrong kind of type.
  const isEmpty = !entries.some((e) => e.budget === budget.id)
  const rows = entriesIn(entries, budget.id)
  const [step, setStep] = useState<'menu' | 'move' | 'sort'>('menu')

  if (step === 'move') {
    const move = (folder: string) => {
      if (folder !== budget.folder) report('move the budget', moveBudget(budget.id, folder))
      onClose()
    }
    const choices = folders
      .map((folder) => ({ id: folder.id, path: folderPath(folders, folder) }))
      .sort((a, b) => a.path.localeCompare(b.path))
    return (
      <Menu
        anchor={anchor}
        label={`Move ${budget.name} to folder`}
        title="Move to folder"
        onClose={onClose}
        items={[
          { label: 'Budgets (top level)', checked: budget.folder === '', onSelect: () => move('') },
          ...choices.map((choice) => ({
            label: choice.path,
            checked: budget.folder === choice.id,
            onSelect: () => move(choice.id),
          })),
        ]}
      />
    )
  }
  if (step === 'sort') {
    const sort = (order: 'largest' | 'smallest') => {
      reorderEntries(sortByAmount(rows, order))
      onClose()
    }
    return (
      <Menu
        anchor={anchor}
        label={`Sort ${budget.name} by amount`}
        title="Sort by amount"
        onClose={onClose}
        items={[
          { label: 'Largest first', onSelect: () => sort('largest') },
          { label: 'Smallest first', onSelect: () => sort('smallest') },
        ]}
      />
    )
  }
  return (
    <Menu
      anchor={anchor}
      label={`Options for ${budget.name}`}
      onClose={onClose}
      items={[
        // A one-off sort; rows can still be moved by hand afterwards.
        ...(rows.length > 1 ? [{ label: 'Sort by amount', onSelect: () => setStep('sort') }] : []),
        {
          label: 'Rename',
          onSelect: () => {
            onClose()
            onRename()
          },
        },
        { label: 'Move to folder', onSelect: () => setStep('move') },
        // Savings & debts can't be copied: their history would have to be copied or made up.
        ...(isTracker(budget)
          ? []
          : [
              {
                label: 'Duplicate',
                onSelect: () => {
                  onClose()
                  report('copy the whole budget', duplicateBudget(budget.id).then(onDuplicated))
                },
              },
            ]),
        {
          label: 'Export as CSV',
          onSelect: () => {
            onClose()
            const csv = toCsv(exportRows({ folders, budgets, entries, snapshots }, budget.id))
            report('export the budget', saveFile(csvFileName(budget.name), csv))
          },
        },
        ...(isEmpty
          ? [
              {
                label: isTracker(budget) ? 'Change to Budget' : 'Change to Savings & debts',
                onSelect: () => {
                  report('change the budget', setBudgetKind(budget.id, isTracker(budget) ? 'budget' : 'tracker'))
                  onClose()
                },
              },
            ]
          : []),
        // No confirm step: the delete, entries and all, can be undone for a few seconds.
        {
          label: 'Delete',
          danger: true,
          onSelect: () => {
            onClose()
            onBeforeDelete?.()
            deleteBudget(budget.id)
          },
        },
      ]}
    />
  )
}

