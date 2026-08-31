import Fuse from 'fuse.js'
import type { Entry } from '@/lib/commands'
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

// Fields a query is matched against, beyond the title.
const SEARCH_KEYS = ['title', 'username', 'website', 'note', 'name', 'tags']

export const filterEntries = (entries: Entry[], options: FilterOptions): Entry[] => {
  const scoped = entries.filter(
    entry => matchScope(entry, options.scope) && matchTags(entry, options.tags)
  )

  const query = options.query.trim()
  if (query === '') return scoped.sort((a, b) => a.title.localeCompare(b.title))

  // Fuzzy rank across all searchable fields (typo-tolerant, relevance-ordered).
  const fuse = new Fuse(scoped, { keys: SEARCH_KEYS, threshold: 0.4, ignoreLocation: true })
  return fuse.search(query).map(result => result.item)
}

const matchScope = (entry: Entry, scope: string) => entry.type === scope

const matchTags = (entry: Entry, tags: string[]) =>
  !tags || tags.length === 0 || !!entry.tags?.some(tag => tags.includes(tag))
