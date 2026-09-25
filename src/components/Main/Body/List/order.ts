import type { EntryMeta } from '@/api/types'
import { KINDS } from '@/kinds'
import { toTime } from '@/utils/time'

// How the entry list is ordered. "recent" is the working order (last edited
// first), "created" its sibling by when the row was made, and "alpha" the flat
// A–Z index.

// An entry's own clock: when it last changed, falling back to when it was made.
export const stampOf = (entry: EntryMeta): string | undefined =>
  entry.updatedAt ?? entry.createdAt

const timeOf = (entry: EntryMeta): number => toTime(stampOf(entry)) ?? 0
const madeAt = (entry: EntryMeta): number => toTime(entry.createdAt) ?? 0

export const byTitle = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort((a, b) => a.title.localeCompare(b.title))

// Recency, with the starred entries pinned on top. Alphabetical is left alone:
// it is the order you reach for to *find* a known title, and pinning would put
// the letter you are looking for somewhere other than where it belongs.
export const byRecency = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite) || timeOf(b) - timeOf(a)
  )

export const byCreated = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite) || madeAt(b) - madeAt(a)
  )

const KIND_RANK = new Map(KINDS.map((kind, rank) => [kind.type, rank]))

// Stable, so each section keeps the order the rows came in.
export const byKind = (entries: EntryMeta[]): EntryMeta[] =>
  [...entries].sort(
    (a, b) => (KIND_RANK.get(a.type) ?? 0) - (KIND_RANK.get(b.type) ?? 0)
  )
