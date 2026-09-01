import { useEffect } from 'react'
import { useStore, openPalette, openGenerator } from '@/store'
import { lockVault } from './Palette/commands'

// The app-level shortcut surface. One listener, one record — a new chord is
// one line here. Mounted from Main, so chords are live only while unlocked.
const BINDINGS: Record<string, () => void> = {
  k: openPalette,
  l: lockVault,
  // Re-pressing ⌘G while the dialog is up must not drop the callback it was
  // opened with, so an open dialog swallows the shortcut.
  g: () => {
    if (!useStore.getState().generator.open) openGenerator()
  }
}

export const useShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const run = BINDINGS[e.key.toLowerCase()]
      if (!run) return
      e.preventDefault()
      run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
