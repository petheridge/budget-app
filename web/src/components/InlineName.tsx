import { useState } from 'react'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'
import { RenameInput } from './RenameInput'

/**
 * An entry's name in a list, which turns into a text box when tapped so it can
 * be renamed in place. Return or tapping elsewhere saves it; Escape or a blank
 * name puts the old one back.
 */
export function InlineName({ entry, className }: { entry: Entry; className: string }) {
  const { updateEntry } = useData()
  const [editing, setEditing] = useState(false)

  async function finish(name: string | null) {
    setEditing(false)
    if (!name) return
    await updateEntry(entry.id, { name, amount_pence: entry.amount_pence, type: entry.type, note: entry.note })
  }

  if (editing) {
    return (
      <RenameInput
        value={entry.name}
        label={`Name for ${entry.name}`}
        onDone={(name) => void finish(name)}
        className={`bg-bg ring-2 ring-brand ring-inset ${className}`}
      />
    )
  }
  return (
    <button
      type="button"
      aria-label={`Rename ${entry.name}`}
      onClick={() => setEditing(true)}
      className={`block max-w-full text-left break-words ${className}`}
    >
      {entry.name}
    </button>
  )
}
