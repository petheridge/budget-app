import { useState } from 'react'

let opened = 0

/**
 * Which menu a screen is showing, if any. Render it with `key={sheet.instance}`,
 * so each opening is a fresh menu rather than the last one with its old state
 * (such as still showing the Move or Sort choices).
 */
export function useOverlay<T extends object>() {
  const [sheet, setSheet] = useState<(T & { instance: number }) | null>(null)
  return {
    sheet,
    open: (value: T) => setSheet({ ...value, instance: ++opened }),
    close: () => setSheet(null),
  }
}
