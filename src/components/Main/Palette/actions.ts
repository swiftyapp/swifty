import { revealEntry, type Entry, type EntryMeta } from '@/lib/commands'
import { useStore, setCurrentEntry, setFilterType, setView } from '@/store'
import { kindOf } from '@/kinds'
import { copy } from '@/services/copy'

// Selects an entry in the list column. The palette searches the whole vault, so
// a result can sit outside whatever the list is currently showing: land on the
// items view and clear a type filter that would hide it, then select. Both run
// before `setCurrentEntry` because both can clear the selection.
export const openEntry = (entry: EntryMeta) => {
  const { filters, ui } = useStore.getState()
  if (ui.view === 'health') setView('items')
  if (filters.type && filters.type !== entry.type) setFilterType(null)
  setCurrentEntry(entry.id)
}

// The one secret worth a shortcut per entry kind.
export const primarySecret = (entry: Entry): string => kindOf(entry.type).primarySecret(entry)

// Decrypts just this entry (secrets never live in the list metadata) and puts
// its primary secret on the clipboard, with the usual auto-clear timeout.
export const copySecret = (entry: EntryMeta): Promise<void> =>
  revealEntry(entry.id)
    .then(revealed => {
      const value = primarySecret(revealed)
      if (value) copy(value)
    })
    .catch(() => {})
