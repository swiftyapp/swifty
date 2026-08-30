// Disable browser reload shortcuts (Cmd/Ctrl+R, F5) inside the webview.
const isReload = (e: KeyboardEvent) =>
  e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r')

window.addEventListener('keydown', e => {
  if (isReload(e)) e.preventDefault()
})
