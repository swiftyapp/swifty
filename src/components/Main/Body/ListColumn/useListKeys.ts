import type { KeyboardEvent } from 'react'
import { useStore, setCurrentEntry } from '@/store'
import { copySecret } from '@/services/entries'
import { useVisibleEntries } from '../List/useVisibleEntries'

// The list column's keyboard surface: ↑/↓ walk the visible rows, ⏎ selects the
// row they land on and ⌘⏎ copies its primary secret. Bound to the column's own
// subtree rather than the window, so the arrows are live whether the search
// field or a row itself has focus — and dead in every other field the app has
// (the editor sheet, Settings, the palette, the generator dialog).
export const useListKeys = () => {
  const entries = useVisibleEntries()
  const currentId = useStore(state => state.entries.current?.id)
  // Where the keyboard sits in the list: -1 when nothing is selected, or when a
  // query has filtered the selection out from under it.
  const index = entries.findIndex(entry => entry.id === currentId)

  return (event: KeyboardEvent<HTMLElement>) => {
    // The row the accelerators act on: the selection while the query still
    // leaves it standing, otherwise the first row left.
    const target = entries[index] ?? entries[0]
    if (!target) return

    if (event.key === 'Enter') {
      // Left unprevented on purpose: a bare ⏎ on a row that is already open
      // belongs to the detail pane's copy accelerator (Aside/Show/Actions).
      if (event.metaKey || event.ctrlKey) void copySecret(target)
      else setCurrentEntry(target.id)
      return
    }

    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    // Clamped, not wrapped — the ends of the list are ends. With nothing
    // selected, either arrow opens the list at its top row.
    const next = Math.min(Math.max(index + step, 0), entries.length - 1)
    setCurrentEntry(entries[next].id)
  }
}
