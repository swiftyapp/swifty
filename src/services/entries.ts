import Fuse from 'fuse.js'
import type { EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'

// Validates a draft has the fields required for its type before saving.
// Cards do not require a PIN — most cards have none.
export const isValid = (entry: EntryDraft): boolean => {
  switch (entry.type) {
    case 'login':
      return !!(entry.title && entry.username && entry.password)
    case 'card':
      return !!(entry.title && entry.number && entry.cvc && entry.month && entry.year)
    case 'note':
      return !!(entry.title && entry.note)
    default:
      return false
  }
}

export interface FilterOptions {
  scope: string
  query: string
  tags: string[]
}

// Fields a query is matched against. Only non-secret list metadata is available
// here (secret fields like username/notes live in the encrypted payload); the
// site host stands in for the website. url_host covers most "which account" searches.
const SEARCH_KEYS = ['title', 'urlHost', 'tags']

export const filterEntries = (entries: EntryMeta[], options: FilterOptions): EntryMeta[] => {
  const scoped = entries.filter(
    entry => matchScope(entry, options.scope) && matchTags(entry, options.tags)
  )

  const query = options.query.trim()
  if (query === '') return scoped.sort((a, b) => a.title.localeCompare(b.title))

  // Fuzzy rank across the searchable metadata (typo-tolerant, relevance-ordered).
  const fuse = new Fuse(scoped, { keys: SEARCH_KEYS, threshold: 0.4, ignoreLocation: true })
  return fuse.search(query).map(result => result.item)
}

const matchScope = (entry: EntryMeta, scope: string) => entry.type === scope

const matchTags = (entry: EntryMeta, tags: string[]) =>
  !tags || tags.length === 0 || !!entry.tags?.some(tag => tags.includes(tag))
