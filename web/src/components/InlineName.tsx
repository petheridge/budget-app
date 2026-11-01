import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useData } from '../lib/data'
import type { Entry } from '../lib/pb'

/**
 * An entry's name in a list, which turns into a text box when tapped so it can
 * be renamed in place. Return or tapping elsewhere saves it; Escape or a blank
 * name puts the old one back.
 */
export function InlineName({ entry, className }: { entry: Entry; className: string }) {
  const { updateEntry } = useData()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(entry.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  function start() {
    done.current = false
    setText(entry.name)
    setEditing(true)
  }

  async function finish(save: boolean) {
    // Escape and the blur that follows it shouldn't both act.
    if (done.current) return
    done.current = true
    setEditing(false)
    const name = text.trim()
    if (!save || !name || name === entry.name) return
    await updateEntry(entry.id, { name, amount_pence: entry.amount_pence, type: entry.type, note: entry.note })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void finish(true)
    }
    if (event.key === 'Escape') void finish(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={`Name for ${entry.name}`}
        enterKeyHint="done"
        autoCapitalize="sentences"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void finish(true)}
        onKeyDown={onKeyDown}
        // 16px text stops iOS zooming in on focus.
        className={`block w-full rounded-md bg-bg px-1 py-0.5 text-base outline-none ring-2 ring-brand ring-inset -mx-1 ${className}`}
      />
    )
  }
  return (
    <button
      type="button"
      aria-label={`Rename ${entry.name}`}
      onClick={start}
      className={`block max-w-full text-left break-words ${className}`}
    >
      {entry.name}
    </button>
  )
}
