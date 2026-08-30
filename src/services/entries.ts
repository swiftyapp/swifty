import type { Entry } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'

// Validates a draft has the fields required for its type before saving.
export const isValid = (entry: EntryDraft): boolean => {
  switch (entry.type) {
    case 'login':
      return !!(entry.title && entry.username && entry.password)
    case 'card':
      return !!(
        entry.title &&
        entry.number &&
        entry.pin &&
        entry.cvc &&
        entry.month &&
        entry.year
      )
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

export const filterEntries = (entries: Entry[], options: FilterOptions): Entry[] =>
  entries
    .filter(
      entry =>
        matchScope(entry, options.scope) &&
        matchQuery(entry, options.query) &&
        matchTags(entry, options.tags)
    )
    .sort((a, b) => a.title.localeCompare(b.title))

const matchScope = (entry: Entry, scope: string) => entry.type === scope

const matchQuery = (entry: Entry, query: string) =>
  query === '' || entry.title.toLowerCase().includes(query.toLowerCase())

const matchTags = (entry: Entry, tags: string[]) =>
  !tags || tags.length === 0 || !!entry.tags?.some(tag => tags.includes(tag))
