import type { Entry, EntryMeta } from '@/api/types'

/**
 * The list row a save comes back as, so the fake backend can answer `save_entry`
 * the way the real one does. Test-only: production never projects an entry
 * itself — it takes the metadata the backend returns.
 */
export const toEntryMeta = (entry: Entry): EntryMeta => ({
  id: entry.id,
  type: entry.type,
  title: entry.title,
  tags: entry.tags ?? [],
  urlHost: '',
  favorite: false
})
