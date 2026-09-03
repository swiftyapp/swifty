import Fuse from 'fuse.js'
import { revealEntry, type EntryMeta, type EntryType } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { kindOf } from '@/kinds'
import { copy } from './copy'

// Validates a draft has the fields required for its kind before saving.
// The rule itself lives with the kind (src/kinds/<kind>/meta.ts).
export const isValid = (draft: EntryDraft): boolean => kindOf(draft.type).isValid(draft)

// Decrypts just this entry (secrets never live in the list metadata) and puts
// the one secret worth a shortcut for its kind on the clipboard, with the usual
// auto-clear timeout. Backs the list search's ⌘⏎.
export const copySecret = (entry: EntryMeta): Promise<void> =>
  revealEntry(entry.id)
    .then(revealed => {
      const value = kindOf(revealed.type).primarySecret(revealed)
      if (value) copy(value)
    })
    .catch(() => {})

export interface FilterOptions {
  // null means every kind — the "All Items" view.
  type: EntryType | null
  query: string
}

// Fields a query is matched against. Only non-secret list metadata is available
// here (secret fields like username/notes live in the encrypted payload); the
// site host stands in for the website. url_host covers most "which account"
// searches, and tags make the search field the way to pull up a tagged set.
const SEARCH_KEYS = ['title', 'urlHost', 'tags']

export const filterEntries = (entries: EntryMeta[], options: FilterOptions): EntryMeta[] => {
  const scoped = entries.filter(entry => matchType(entry, options.type))

  // Unordered without a query: the list's own sort (recency or A–Z) is applied
  // downstream, so ordering here would only be thrown away.
  const query = options.query.trim()
  if (query === '') return scoped

  // Fuzzy rank across the searchable metadata (typo-tolerant, relevance-ordered).
  const fuse = new Fuse(scoped, { keys: SEARCH_KEYS, threshold: 0.4, ignoreLocation: true })
  return fuse.search(query).map(result => result.item)
}

const matchType = (entry: EntryMeta, type: EntryType | null) => !type || entry.type === type
