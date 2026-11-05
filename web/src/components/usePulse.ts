import { useEffect, useRef, type RefObject } from 'react'

/**
 * A brief pulse on a total when it changes, confirming that a change went in:
 * an amount saved, an entry added, deleted or undone (here or on another phone).
 * Not when the screen first shows it, and not when the phone is set to reduce motion.
 */
export function usePulse<T extends HTMLElement>(value: unknown, ref: RefObject<T | null>) {
  const previous = useRef(value)
  useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    const el = ref.current
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], {
      duration: 300,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    })
  }, [value, ref])
}
