import { useLocation } from 'react-router-dom'

/**
 * Thin fixed bars at the top and bottom edges of the screen, for iOS.
 *
 * On iOS 26 and later, WebKit checks each screen edge for a fixed, near
 * full-width, opaque element. When it finds one, it fills any area at that edge
 * that the page doesn't cover with the element's colour. It also turns off the
 * blur iOS otherwise draws over the page under the status bar. Our header and
 * footer can't serve: they sit inside the full-screen fixed body, which WebKit
 * skips. Without these bars, the home-screen app shows the page background
 * (brand) in the strip by the home indicator, and the header text is blurred.
 * See fixedContainerEdges in WebKit's LocalFrameView.cpp.
 *
 * Rules the bars must meet: position fixed, width 90–105% of the viewport,
 * more than 10px tall, an opaque background, and on top at a point 4px in from
 * the edge. pointer-events: none keeps them out of the way of taps, and WebKit
 * still finds them. z-30 keeps them under sheets (z-40), so a sheet's dimmed
 * backdrop wins while it's open. Only shown in the home-screen app, the case
 * they're for; in a desktop browser they'd run past the centred column.
 */
export function EdgeBars() {
  const { pathname } = useLocation()
  // Every screen but sign-in has a white footer at the bottom.
  const bottom = pathname === '/login' ? 'bg-bg' : 'bg-surface'
  const bar = 'pointer-events-none fixed inset-x-0 z-30 hidden standalone:block'
  return (
    <>
      <div aria-hidden className={`${bar} top-0 h-[max(env(safe-area-inset-top),12px)] bg-brand`} />
      <div aria-hidden className={`${bar} bottom-0 h-[max(env(safe-area-inset-bottom),12px)] ${bottom}`} />
    </>
  )
}
