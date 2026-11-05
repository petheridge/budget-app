import { useLayoutEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'

/**
 * A text box for changing a name or note in place, shown where it was. It opens
 * focused with the text selected. Return or tapping elsewhere finishes with the
 * new text; Escape or no change finishes with null, and so does blank text
 * unless `allowBlank` (a note can be cleared; a name can't).
 */
export function RenameInput({
  value,
  label,
  onDone,
  className,
  placeholder,
  allowBlank = false,
}: {
  value: string
  label: string
  onDone: (text: string | null) => void
  className: string
  placeholder?: string
  allowBlank?: boolean
}) {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  // Focused straight away, while still handling the tap that opened it, so iOS shows the keyboard.
  useLayoutEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function finish(save: boolean) {
    // Escape and the blur that follows it shouldn't both act.
    if (done.current) return
    done.current = true
    const next = text.trim()
    onDone(save && (next || allowBlank) && next !== value ? next : null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    }
    if (event.key === 'Escape') finish(false)
  }

  // Pressing and holding in the box selects text; it mustn't pick up the row to reorder it.
  const keepToSelf = (event: SyntheticEvent) => event.stopPropagation()

  return (
    <input
      ref={inputRef}
      aria-label={label}
      enterKeyHint="done"
      autoCapitalize="sentences"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={onKeyDown}
      onTouchStart={keepToSelf}
      onMouseDown={keepToSelf}
      onClick={keepToSelf}
      // 16px text stops iOS zooming in on focus.
      className={`block w-full min-w-0 rounded-md px-1 py-0.5 text-base outline-none select-text -mx-1 placeholder:text-muted ${className}`}
    />
  )
}
