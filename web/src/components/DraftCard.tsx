import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { FolderIcon } from './icons'

/**
 * A new budget or folder typed straight into the list, as a card at the end, the
 * way entries are added. Return or tapping anywhere outside the card saves it; a
 * blank name, Escape or × discards it. `onSave` may throw: the card stays, with a
 * message, to try again.
 */
export function DraftCard({
  kind,
  label,
  placeholder,
  onSave,
  onDone,
}: {
  kind: 'budget' | 'folder'
  label: string
  placeholder: string
  onSave: (name: string) => Promise<void>
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const saving = useRef(false)

  // Focused while still handling the tap that opened it, so iOS shows the keyboard.
  useLayoutEffect(() => {
    inputRef.current?.focus()
    cardRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  async function commit() {
    if (saving.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      onDone()
      return
    }
    saving.current = true
    try {
      await onSave(trimmed)
      onDone()
    } catch {
      saving.current = false
      setError("Couldn't save. Press Return to try again.")
    }
  }

  // Tapping outside the card saves it. iOS doesn't always blur a text box when
  // something that can't take focus is tapped, so this watches taps instead.
  const commitRef = useRef(commit)
  useLayoutEffect(() => {
    commitRef.current = commit
  })
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return
      void commitRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') onDone()
    if (event.key !== 'Enter') return
    event.preventDefault()
    void commit()
  }

  return (
    <div
      ref={cardRef}
      className="enter mt-2.5 flex min-h-[68px] items-stretch rounded-xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.1)] ring-2 ring-brand"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center pr-2 pl-4">
        <div className="flex items-center gap-2">
          {kind === 'folder' && <FolderIcon />}
          <input
            ref={inputRef}
            aria-label={label}
            placeholder={placeholder}
            enterKeyHint="done"
            autoCapitalize="words"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            onKeyDown={onKeyDown}
            // 16px text stops iOS zooming in on focus.
            className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-muted"
          />
        </div>
        {error && <p className="text-xs text-expense">{error}</p>}
      </div>
      <button
        type="button"
        aria-label="Cancel"
        onClick={onDone}
        className="my-3 flex w-10 shrink-0 items-center justify-center border-l border-line text-xl text-muted"
      >
        ×
      </button>
    </div>
  )
}
