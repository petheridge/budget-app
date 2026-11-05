import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  /** Shown greyed out, with `hint` underneath saying why. */
  disabled?: boolean
  hint?: string
  /** For a choice of one, such as which folder: true shows a tick. */
  checked?: boolean
}

/** Gap kept between the menu and the screen edges, and between it and its button. */
const MARGIN = 8
const GAP = 4

/**
 * A small menu that opens from the button that was tapped, as ⋯ menus do on iOS.
 * It drops down from the button, or opens upwards when there isn't room below.
 *
 * Tapping outside, scrolling or Escape closes it without acting on whatever is
 * underneath. Choosing an item calls its `onSelect`, which closes the menu or
 * replaces it, such as with a submenu.
 */
export function Menu({
  anchor,
  label,
  title,
  items,
  onClose,
}: {
  anchor: HTMLElement
  label: string
  title?: string
  items: MenuItem[]
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const safeTopRef = useRef<HTMLDivElement>(null)
  const safeBottomRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [place, setPlace] = useState<{ top: number; left: number; maxHeight?: number; up: boolean } | null>(null)

  // Measured before the first paint, so it never shows in the wrong place.
  useLayoutEffect(() => {
    const menu = menuRef.current!
    const button = anchor.getBoundingClientRect()
    const viewWidth = window.innerWidth
    const viewHeight = window.visualViewport?.height ?? window.innerHeight
    const top = (safeTopRef.current?.offsetHeight ?? 0) + MARGIN
    const bottom = viewHeight - (safeBottomRef.current?.offsetHeight ?? 0) - MARGIN
    const { offsetWidth: width, offsetHeight: height } = menu

    // Right edges line up, since the buttons are on the right; kept on screen either way.
    const left = Math.min(Math.max(button.right - width, MARGIN), viewWidth - width - MARGIN)
    const roomBelow = bottom - (button.bottom + GAP)
    const roomAbove = button.top - GAP - top
    if (height <= roomBelow) setPlace({ top: button.bottom + GAP, left, up: false })
    else if (height <= roomAbove) setPlace({ top: button.top - GAP - height, left, up: true })
    // Taller than either side, which only a very short screen would cause: scroll it.
    else if (roomBelow >= roomAbove) setPlace({ top: button.bottom + GAP, left, maxHeight: roomBelow, up: false })
    else setPlace({ top, left, maxHeight: roomAbove, up: true })
  }, [anchor])

  // Callers pass a new function each render; only the latest one matters.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  const placed = place !== null
  useEffect(() => {
    // Keyboard users land on the first item, once it's shown: a hidden one can't take focus.
    if (!placed) return
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
  }, [placed])

  useEffect(() => {
    const dismiss = () => {
      onCloseRef.current()
      anchor.focus({ preventScroll: true })
    }
    // Escape works wherever focus is, as a tap on the ⋮ may not have moved it.
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    // The button it hangs from may have moved.
    const close = () => onCloseRef.current()
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  function dismiss() {
    onClose()
    anchor.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      event.preventDefault()
      dismiss()
      return
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const all = [...menuRef.current!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
    const at = all.indexOf(document.activeElement as HTMLElement)
    all[(at + step + all.length) % all.length]?.focus()
  }

  // A tap outside closes the menu. So does the start of a swipe, as it does on iOS.
  function onBackdropPointerDown(event: PointerEvent) {
    start.current = { x: event.clientX, y: event.clientY }
  }
  function onBackdropPointerMove(event: PointerEvent) {
    const s = start.current
    if (s && Math.hypot(event.clientX - s.x, event.clientY - s.y) > 10) {
      start.current = null
      dismiss()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        data-testid="menu-backdrop"
        className="absolute inset-0 touch-none"
        onPointerDown={onBackdropPointerDown}
        onPointerMove={onBackdropPointerMove}
        onClick={dismiss}
      />
      <div ref={safeTopRef} aria-hidden className="pointer-events-none fixed top-0 h-[env(safe-area-inset-top)] w-0" />
      <div ref={safeBottomRef} aria-hidden className="pointer-events-none fixed bottom-0 h-[env(safe-area-inset-bottom)] w-0" />
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`menu-in absolute w-[250px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-xl bg-raised shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-line ${place?.up ? 'origin-bottom-right' : 'origin-top-right'}`}
        style={
          place
            ? { top: place.top, left: place.left, maxHeight: place.maxHeight }
            : { top: 0, left: 0, visibility: 'hidden' }
        }
      >
        {title && (
          <p className="truncate border-b border-line px-4 py-2 text-xs text-muted">{title}</p>
        )}
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={item.checked}
            aria-disabled={item.disabled || undefined}
            onClick={() => {
              if (!item.disabled) item.onSelect()
            }}
            className={`flex min-h-11 w-full items-center gap-2 border-b border-line px-4 py-2.5 text-left text-base last:border-b-0 focus-visible:bg-bg focus-visible:outline-none active:bg-bg ${
              item.disabled ? 'cursor-default text-muted' : item.danger ? 'text-expense' : 'text-text'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
            </span>
            {item.checked && (
              <span aria-hidden className="font-bold text-brand">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
