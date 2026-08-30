// Sets the `platform` attribute the stylesheets use for OS-specific tweaks.
// Detected from the browser since the Tauri OS plugin needs src-tauri (PR-5).
export const applyPlatform = () => {
  const ua = navigator.userAgent
  const isMac = /Mac/.test(ua)
  const isWin = /Win/.test(ua)
  document.body.setAttribute('platform', isMac ? 'macos' : isWin ? 'windows' : 'linux')
  document
    .getElementById('root')
    ?.setAttribute('platform', isMac ? 'darwin' : isWin ? 'win32' : 'linux')
}
