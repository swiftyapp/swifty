import type { StateCreator } from 'zustand'
import type { EntryMeta, EntryType } from '@/lib/commands'
import type { StoreState } from './index'

interface Entries {
  // `new` carries the kind being created (null when nothing is), so the editor
  // no longer has to infer it from whatever the list is filtered to.
  new: EntryType | null
  edit: boolean
  current: EntryMeta | null
  items: EntryMeta[]
  // Tombstones, as the Trash view lists them. Not part of the unlock payload,
  // so this stays empty until the Trash is opened.
  trash: EntryMeta[]
  // Field values waiting for an editor to take them (what a scan read out of an
  // image). Consumed once — `useDraft` folds them into the draft and clears
  // them, so nothing is left to seed the next entry with.
  prefill: Record<string, string> | null
}

export interface EntriesSlice {
  entries: Entries
  newEntry: (type: EntryType, prefill?: Record<string, string>) => void
  setPrefill: (prefill: Record<string, string>) => void
  clearPrefill: () => void
  setNoEntry: () => void
  editEntry: () => void
  setEntries: (items: EntryMeta[]) => void
  setTrash: (trash: EntryMeta[]) => void
  setCurrentEntry: (id: string) => void
}

// Selection is by id across every row the app holds, live or tombstoned, so the
// Trash needs no selection path of its own.
const find = (entries: Entries, id?: string) =>
  [...entries.items, ...entries.trash].find(item => item.id === id) ?? null

export const createEntriesSlice: StateCreator<StoreState, [], [], EntriesSlice> = (set, get) => ({
  entries: { new: null, edit: false, current: null, items: [], trash: [], prefill: null },
  newEntry: (type, prefill) =>
    set(s => ({
      entries: { ...s.entries, new: type, edit: false, current: null, prefill: prefill ?? null }
    })),
  setPrefill: prefill => set(s => ({ entries: { ...s.entries, prefill } })),
  clearPrefill: () => set(s => ({ entries: { ...s.entries, prefill: null } })),
  setNoEntry: () =>
    set(s => ({
      entries: { ...s.entries, new: null, edit: false, current: null, prefill: null }
    })),
  // A tombstone has no editable form: `reveal_entry` refuses deleted rows, so an
  // edit would open a pane that can never load its own values and whose save
  // would resurrect the entry behind the user's back. Refusing here rather than
  // at each entry point means ⌘E, the read header, the palette and anything
  // added later all inherit it — the detail pane's read-only-ness stops being a
  // fact each caller has to remember.
  editEntry: () => {
    if (get().entries.current?.deletedAt) return
    set(s => ({ entries: { ...s.entries, edit: true, new: null } }))
  },
  // The list is replaced wholesale by a sync merge as well as by our own
  // writes, so the selection is re-resolved against the incoming rows: keeping
  // the old object would show a stale title, and keeping a row the merge
  // dropped would show an entry the vault no longer has.
  setEntries: items =>
    set(s => ({
      entries: {
        ...s.entries,
        items,
        // Resolved through `find` so a selected tombstone (Trash view) is not
        // dropped by a merge that only ever carries live rows.
        current: s.entries.current ? find({ ...s.entries, items }, s.entries.current.id) : null
      }
    })),
  setTrash: trash => set(s => ({ entries: { ...s.entries, trash } })),
  // Also what a save lands on: selecting the row just written is the same
  // state change as selecting any other row.
  setCurrentEntry: id =>
    set(s => ({
      entries: { ...s.entries, current: find(s.entries, id), new: null, edit: false }
    }))
})
