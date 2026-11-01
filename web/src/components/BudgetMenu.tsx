import { useState } from 'react'
import { useData } from '../lib/data'
import { isTracker, type Budget } from '../lib/pb'
import { entriesIn, sortByAmount } from '../lib/selectors'
import { ActionSheet, ConfirmSheet, FolderSelect, FormSheet, NameSheet } from './Sheet'

export function BudgetMenu({
  budget,
  onClose,
  onBeforeDelete,
}: {
  budget: Budget
  onClose: () => void
  onBeforeDelete?: () => void
}) {
  const { renameBudget, deleteBudget, setBudgetKind, entries, reorderEntries } = useData()
  // A budget's type can only change while it's empty, so no entry has the wrong kind of type.
  const isEmpty = !entries.some((e) => e.budget === budget.id)
  const rows = entriesIn(entries, budget.id)
  const [step, setStep] = useState<'menu' | 'rename' | 'move' | 'delete' | 'sort'>('menu')

  if (step === 'rename') {
    return (
      <NameSheet
        title="Rename Budget"
        initialName={budget.name}
        onSave={(name) => renameBudget(budget.id, name)}
        onClose={onClose}
      />
    )
  }
  if (step === 'move') return <MoveSheet budget={budget} onClose={onClose} />
  if (step === 'sort') {
    const sort = (order: 'largest' | 'smallest') => {
      reorderEntries(sortByAmount(rows, order))
      onClose()
    }
    return (
      <ActionSheet
        title={`Sort ${budget.name} by amount`}
        onClose={onClose}
        actions={[
          { label: 'Largest first', onClick: () => sort('largest') },
          { label: 'Smallest first', onClick: () => sort('smallest') },
        ]}
      />
    )
  }
  if (step === 'delete') {
    return (
      <ConfirmSheet
        title={`Delete "${budget.name}"?`}
        message="This also deletes all of its entries, and can't be undone."
        confirmLabel="Delete Budget"
        onConfirm={() => {
          onBeforeDelete?.()
          deleteBudget(budget.id)
          onClose()
        }}
        onClose={onClose}
      />
    )
  }
  return (
    <ActionSheet
      title={budget.name}
      onClose={onClose}
      actions={[
        // A one-off sort; rows can still be moved by hand afterwards.
        ...(rows.length > 1 ? [{ label: 'Sort by amount', onClick: () => setStep('sort') }] : []),
        { label: 'Rename', onClick: () => setStep('rename') },
        { label: 'Move to folder', onClick: () => setStep('move') },
        ...(isEmpty
          ? [
              {
                label: isTracker(budget) ? 'Change to Budget' : 'Change to Savings & debts',
                onClick: () => {
                  void setBudgetKind(budget.id, isTracker(budget) ? 'budget' : 'tracker')
                  onClose()
                },
              },
            ]
          : []),
        { label: 'Delete', danger: true, onClick: () => setStep('delete') },
      ]}
    />
  )
}

function MoveSheet({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const { moveBudget } = useData()
  const [folder, setFolder] = useState(budget.folder)

  async function save() {
    if (folder !== budget.folder) await moveBudget(budget.id, folder)
    onClose()
  }

  return (
    <FormSheet title="Move to Folder" onSave={save} onClose={onClose}>
      <FolderSelect label="Folder" value={folder} onChange={setFolder} />
    </FormSheet>
  )
}
