import { useData } from '../lib/data'
import type { Folder } from '../lib/pb'
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
  const { folders, budgets, deleteFolder } = useData()
  const empty =
    !budgets.some((b) => b.folder === folder.id) && !folders.some((f) => f.parent === folder.id)

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
