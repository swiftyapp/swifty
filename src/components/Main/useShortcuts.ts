import { useEffect } from 'react'
import { useStore, openPalette, openGenerator, openAddPicker, editEntry } from '@/store'
import { dialogOpen } from '@/utils/dialogOpen'
import { focusSearch } from '@/utils/focusSearch'
import { lockVault } from './Palette/commands'

// The app-level shortcut surface. One listener, one record — a new chord is
// one line here. Mounted from Main, so chords are live only while unlocked.
const BINDINGS: Record<string, () => void> = {
  k: openPalette,
  l: lockVault,
  // Re-pressing ⌘G must not drop the callback the generator was opened with.
  // Guarded on the store as well as the DOM: the flag flips before the card
  // mounts, so one press cannot queue a second open.
  g: () => {
    if (!useStore.getState().generator.open) openGenerator()
  },
  n: openAddPicker,
  f: focusSearch,
  // Edit whatever the list has selected — nothing to edit without a selection.
  e: () => {
    if (useStore.getState().entries.current) editEntry()
  }
}

export const useShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const run = BINDINGS[e.key.toLowerCase()]
      if (!run) return
      e.preventDefault()
      // A dialog owns the keyboard while it is up: every chord here would
      // otherwise act on the shell behind the scrim — opening a second modal,
      // pulling focus into the list column, or editing what the dialog covers.
      if (dialogOpen()) return
      run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
