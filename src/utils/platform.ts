// Sets the `platform` attribute the stylesheets use for OS-specific tweaks.
// Detected from the browser since the Tauri OS plugin needs src-tauri (PR-5).
// A PC's desktop webview — the one place the app's chords are held with Ctrl
// (`useShortcuts` takes either modifier). Read off the UA rather than the
// Tauri platform so a browser preview and the test runner agree with the
// desktop: jsdom reports the Node platform ("darwin"), never "Mac", so
// anything that is not visibly a PC reads as the Apple default.
const PC = /Win|Linux|X11/.test(navigator.userAgent)

/**
 * A shortcut hint for `key` as this platform spells it: `⌘F` on Apple
 * hardware, `Ctrl+F` on a PC. Every hint chip in the app (`Kbd`, the empty
 * states' hint rows) should go through here rather than hardcoding ⌘.
 */
export const chord = (key: string) => (PC ? `Ctrl+${key}` : `⌘${key}`)

export const applyPlatform = () => {
  const ua = navigator.userAgent
  const isMac = /Mac/.test(ua)
  const isWin = /Win/.test(ua)
  document.body.setAttribute('platform', isMac ? 'macos' : isWin ? 'windows' : 'linux')
  document
    .getElementById('root')
    ?.setAttribute('platform', isMac ? 'darwin' : isWin ? 'win32' : 'linux')
}
