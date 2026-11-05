import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { linkTarget } from '../lib/selectors'
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
  const { deleteEntry, entries, budgets } = useData()
  const navigate = useNavigate()
  const tracked = entry.type === 'saving' || entry.type === 'debt'
  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <Menu
      anchor={anchor}
      label={`Options for ${entry.name}`}
      onClose={onClose}
      items={[
        ...(tracked ? [{ label: 'History', onSelect: () => go(`/entry/${entry.id}/history`) }] : []),
        // Money going out of a budget into a saving or onto a debt.
        ...(entry.type === 'expense'
          ? [
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
