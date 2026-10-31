import { useState } from 'react'
import { useData } from '../lib/data'
import type { Budget } from '../lib/pb'
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
  const { renameBudget, deleteBudget } = useData()
  const [step, setStep] = useState<'menu' | 'rename' | 'move' | 'delete'>('menu')

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
        { label: 'Rename', onClick: () => setStep('rename') },
        { label: 'Move to folder', onClick: () => setStep('move') },
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
