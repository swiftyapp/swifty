import Fuse from 'fuse.js'
import type { EntryMeta, EntryType } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { kindOf } from '@/kinds'

// Validates a draft has the fields required for its kind before saving.
// The rule itself lives with the kind (src/kinds/<kind>/meta.ts).
export const isValid = (draft: EntryDraft): boolean => kindOf(draft.type).isValid(draft)

export interface FilterOptions {
  // null means every kind — the "All Items" view.
  type: EntryType | null
  query: string
  tags: string[]
}

// Fields a query is matched against. Only non-secret list metadata is available
// here (secret fields like username/notes live in the encrypted payload); the
// site host stands in for the website. url_host covers most "which account" searches.
const SEARCH_KEYS = ['title', 'urlHost', 'tags']

export const filterEntries = (entries: EntryMeta[], options: FilterOptions): EntryMeta[] => {
  const scoped = entries.filter(
    entry => matchType(entry, options.type) && matchTags(entry, options.tags)
  )

  const query = options.query.trim()
  if (query === '') return scoped.sort((a, b) => a.title.localeCompare(b.title))

  // Fuzzy rank across the searchable metadata (typo-tolerant, relevance-ordered).
  const fuse = new Fuse(scoped, { keys: SEARCH_KEYS, threshold: 0.4, ignoreLocation: true })
  return fuse.search(query).map(result => result.item)
}

const matchType = (entry: EntryMeta, type: EntryType | null) => !type || entry.type === type

const matchTags = (entry: EntryMeta, tags: string[]) =>
  !tags || tags.length === 0 || !!entry.tags?.some(tag => tags.includes(tag))
