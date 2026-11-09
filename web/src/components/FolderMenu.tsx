import { useState } from 'react'
import { useData } from '../lib/data'
import type { Folder } from '../lib/pb'
import { folderDestinations, folderPath } from '../lib/selectors'
import { Menu } from './Menu'

export function FolderMenu({
  folder,
  anchor,
  onClose,
  onRename,
}: {
  folder: Folder
  /** The button the menu opens from. */
  anchor: HTMLElement
  onClose: () => void
  /** Rename is done in place, on the folder's card. */
  onRename: () => void
}) {
  const { folders, budgets, deleteFolder, moveFolder, report } = useData()
  const [step, setStep] = useState<'menu' | 'move'>('menu')
  const empty =
    !budgets.some((b) => b.folder === folder.id) && !folders.some((f) => f.parent === folder.id)

  if (step === 'move') {
    const move = (parent: string) => {
      if (parent !== folder.parent) report('move the folder', moveFolder(folder.id, parent))
      onClose()
    }
    // Not itself or anything inside it, or it would vanish from every screen.
    const choices = folderDestinations(folders, folder)
      .map((f) => ({ id: f.id, path: folderPath(folders, f) }))
      .sort((a, b) => a.path.localeCompare(b.path))
    return (
      <Menu
        anchor={anchor}
        label={`Move ${folder.name} to folder`}
        title="Move to folder"
        onClose={onClose}
        items={[
          { label: 'Budgets (top level)', checked: folder.parent === '', onSelect: () => move('') },
          ...choices.map((choice) => ({
            label: choice.path,
            checked: folder.parent === choice.id,
            onSelect: () => move(choice.id),
          })),
        ]}
      />
    )
  }

  return (
    <Menu
      anchor={anchor}
      label={`Options for ${folder.name}`}
      onClose={onClose}
      items={[
        {
          label: 'Rename',
          onSelect: () => {
            onClose()
            onRename()
          },
        },
        { label: 'Move to folder', onSelect: () => setStep('move') },
        // Says up front why it can't be deleted, rather than after trying. Only an
        // empty folder can go, and nothing is lost with it, so there's no confirm step.
        {
          label: 'Delete',
          danger: true,
          disabled: !empty,
          hint: empty ? undefined : 'Move or delete what’s inside first',
          onSelect: () => {
            onClose()
            deleteFolder(folder.id)
          },
        },
      ]}
    />
  )
}
