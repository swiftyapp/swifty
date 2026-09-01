import type { EntryMeta } from '@/lib/commands'
import { toTime } from '@/utils/time'

// How the entry list is ordered. "recent" is the working order (newest
// first); "alpha" is the flat A–Z index.

// An entry's own clock: when it last changed, falling back to when it was made.
export const stampOf = (entry: EntryMeta): string | undefined =>
  entry.updatedAt ?? entry.createdAt

const timeOf = (entry: EntryMeta): number => toTime(stampOf(entry)) ?? 0

export const byTitle = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort((a, b) => a.title.localeCompare(b.title))

export const byRecency = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort((a, b) => timeOf(b) - timeOf(a))
