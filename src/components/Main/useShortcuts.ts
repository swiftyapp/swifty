import { useEffect } from 'react'
import { useStore, openPalette, openGenerator, openAddPicker } from '@/store'
import { focusSearch } from './Body/ListColumn/focus'
import { lockVault } from './Palette/commands'

// True while a dialog owns the keyboard. A chord that would reach the shell
// underneath it (opening a second modal, or pulling focus into the list column
// behind the scrim) is swallowed instead.
const dialogOpen = () => {
  const { palette, settings, addPicker } = useStore.getState().ui
  return palette || settings || addPicker
}

// The app-level shortcut surface. One listener, one record — a new chord is
// one line here. Mounted from Main, so chords are live only while unlocked.
const BINDINGS: Record<string, () => void> = {
  k: openPalette,
  l: lockVault,
  // Re-pressing ⌘G while the dialog is up must not drop the callback it was
  // opened with, so an open dialog swallows the shortcut.
  g: () => {
    if (!useStore.getState().generator.open) openGenerator()
  },
  n: () => {
    if (!dialogOpen()) openAddPicker()
  },
  f: () => {
    if (!dialogOpen()) focusSearch()
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
