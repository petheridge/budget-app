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
  const { updateEntry, report } = useData()
  const [editing, setEditing] = useState(false)

  function finish(name: string | null) {
    setEditing(false)
    if (name) report('save the name', updateEntry(entry.id, { name }))
  }

  if (editing) {
    return (
      <RenameInput
        value={entry.name}
        label={`Name for ${entry.name}`}
        onDone={finish}
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
