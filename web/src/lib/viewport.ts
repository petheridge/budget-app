// iOS home-screen apps with a translucent status bar draw the page from the very
// top of the screen but size the viewport as if the status bar took up room, so
// the page stops short and a strip by the home indicator is left unpainted.
// There the app always fills the whole screen, so size the page to the screen.
// The page is never made shorter than the viewport, so this does nothing once
// iOS reports the right height.

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function update() {
  const { width, height } = window.screen
  const landscape = window.matchMedia('(orientation: landscape)').matches
  // iOS keeps screen.width/height in portrait terms whatever the orientation.
  const screenWidth = landscape ? Math.max(width, height) : Math.min(width, height)
  const screenHeight = landscape ? Math.min(width, height) : Math.max(width, height)
  // Only when the app fills the screen (not an iPad window or split view).
  const fullScreen = window.innerWidth === screenWidth
  const appHeight = fullScreen ? Math.max(window.innerHeight, screenHeight) : window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${appHeight}px`)
}

export function fitStandaloneViewport() {
  if (!isStandalone()) return
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}
