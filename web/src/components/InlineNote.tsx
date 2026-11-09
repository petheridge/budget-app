import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { PencilIcon } from './icons'
import { RenameInput } from './RenameInput'

/**
 * The small grey note under an entry's name, if it has one. While `editing` (from
 * Add note or Edit note in the ⋮ menu) it's a text box in place: Return or tapping
 * elsewhere saves, Escape keeps the old note, and clearing it removes the note.
 */
export function InlineNote({
  entry,
  editing,
  onDone,
}: {
  entry: Entry
  editing: boolean
  onDone: () => void
}) {
  const { updateEntry, report } = useData()

  if (editing) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-muted">
        <PencilIcon />
        <RenameInput
          value={entry.note}
          label={`Note for ${entry.name}`}
          placeholder="Add a note"
          allowBlank
          onDone={(note) => {
            onDone()
            if (note === null) return
            report('save the note', updateEntry(entry.id, { note }))
          }}
          className="bg-bg text-text ring-2 ring-brand ring-inset"
        />
      </span>
    )
  }
  if (!entry.note) return null
  return (
    <span className="mt-0.5 flex items-start gap-1 text-xs break-words text-muted">
      <PencilIcon />
      <span className="min-w-0">{entry.note}</span>
    </span>
  )
}
