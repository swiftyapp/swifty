import { revealEntry, type Entry, type EntryMeta } from '@/lib/commands'
import { useStore, setCurrentEntry, setFilterScope } from '@/store'
import { copy } from '@/services/copy'

// Selects an entry in the list column, switching scope first when it lives
// under a different tab (`setFilterScope` clears the selection, so it has to
// run before `setCurrentEntry`).
export const openEntry = (entry: EntryMeta) => {
  if (useStore.getState().filters.scope !== entry.type) setFilterScope(entry.type)
  setCurrentEntry(entry.id)
}

// The one secret worth a shortcut per entry type.
export const primarySecret = (entry: Entry): string => {
  switch (entry.type) {
    case 'login':
      return entry.password
    case 'card':
      return entry.number
    case 'note':
      return entry.note
  }
}

// Decrypts just this entry (secrets never live in the list metadata) and puts
// its primary secret on the clipboard, with the usual auto-clear timeout.
export const copySecret = (entry: EntryMeta): Promise<void> =>
  revealEntry(entry.id)
    .then(revealed => {
      const value = primarySecret(revealed)
      if (value) copy(value)
    })
    .catch(() => {})
