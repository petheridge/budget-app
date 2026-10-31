import { useState } from 'react'
import { useData } from '../lib/data'
import type { Folder } from '../lib/pb'
import { ActionSheet, ConfirmSheet, NameSheet, NoticeSheet } from './Sheet'

export function FolderMenu({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const { folders, budgets, renameFolder, deleteFolder } = useData()
  const [step, setStep] = useState<'menu' | 'rename' | 'delete'>('menu')

  if (step === 'rename') {
    return (
      <NameSheet
        title="Rename Folder"
        initialName={folder.name}
        onSave={(name) => renameFolder(folder.id, name)}
        onClose={onClose}
      />
    )
  }
  if (step === 'delete') {
    const empty =
      !budgets.some((b) => b.folder === folder.id) && !folders.some((f) => f.parent === folder.id)
    if (!empty) {
      return (
        <NoticeSheet
          title="This folder isn't empty"
          message={`Move or delete everything inside "${folder.name}" first, then you can delete the folder.`}
          onClose={onClose}
        />
      )
    }
    return (
      <ConfirmSheet
        title={`Delete "${folder.name}"?`}
        message="This can't be undone."
        confirmLabel="Delete Folder"
        onConfirm={() => {
          deleteFolder(folder.id)
          onClose()
        }}
        onClose={onClose}
      />
    )
  }
  return (
    <ActionSheet
      title={folder.name}
      onClose={onClose}
      actions={[
        { label: 'Rename', onClick: () => setStep('rename') },
        { label: 'Delete', danger: true, onClick: () => setStep('delete') },
      ]}
    />
  )
}
