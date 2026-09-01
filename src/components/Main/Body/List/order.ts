import type { EntryMeta } from '@/lib/commands'
import { recencyBucket, toTime, RECENCY, type Recency } from '@/utils/time'

// How the entry list is ordered. "recent" is the working order (newest first,
// split into recency groups); "alpha" is the flat A–Z index.
export interface EntryGroup {
  title: Recency
  entries: EntryMeta[]
}

// An entry's own clock: when it last changed, falling back to when it was made.
export const stampOf = (entry: EntryMeta): string | undefined =>
  entry.updatedAt ?? entry.createdAt

const timeOf = (entry: EntryMeta): number => toTime(stampOf(entry)) ?? 0

export const byTitle = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort((a, b) => a.title.localeCompare(b.title))

export const byRecency = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort((a, b) => timeOf(b) - timeOf(a))

// Newest first, cut into Today / Yesterday / This week / Earlier. Empty buckets
// drop out, so the headers only ever describe rows that are there.
export const groupByRecency = (
  entries: EntryMeta[],
  now: number = Date.now()
): EntryGroup[] => {
  const sorted = byRecency(entries)
  return RECENCY.map(title => ({
    title,
    entries: sorted.filter(entry => recencyBucket(stampOf(entry), now) === title)
  })).filter(group => group.entries.length > 0)
}
