import type { EntryMeta } from '@/lib/commands'

/**
 * Matching for the ⌘K palette.
 *
 * The list column already has its own search (`services/entries.filterEntries`,
 * Fuse over one scope). The palette needs something different: it ranks across
 * every scope *and* across non-entry items (commands) in one pass, so it scores
 * plain weighted fields instead. Deliberately dependency-free and synchronous —
 * it re-runs on every keystroke.
 *
 * Three tiers, best first: prefix > substring (earlier is better) > subsequence
 * (tighter span is better). A field's weight multiplies its score, so a title
 * hit outranks a tag hit.
 */

const PREFIX = 1000
const SUBSTRING = 500
const SUBSEQUENCE = 100

// Caps the positional penalty so a very long field can never score below the
// tier beneath it.
const MAX_PENALTY = 99

export interface Field {
  text: string
  // Relative importance; defaults to 1.
  weight?: number
}

// Score of `query` against one string, or null when it doesn't match at all.
// An empty query matches everything with a neutral score.
export const scoreText = (text: string, query: string): number | null => {
  if (query === '') return 0
  if (text === '') return null

  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()

  const index = haystack.indexOf(needle)
  if (index === 0) return PREFIX
  if (index > 0) return SUBSTRING - Math.min(index, MAX_PENALTY)

  const span = subsequenceSpan(haystack, needle)
  return span === null ? null : SUBSEQUENCE - Math.min(span, MAX_PENALTY)
}

// Distance between the first and last character of a greedy left-to-right
// subsequence match, or null when the needle isn't a subsequence at all.
const subsequenceSpan = (haystack: string, needle: string): number | null => {
  let first = -1
  let cursor = 0

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor)
    if (found === -1) return null
    if (first === -1) first = found
    cursor = found + 1
  }

  return cursor - 1 - first
}

// Best score across an item's fields, or null when none of them match.
export const scoreFields = (fields: Field[], query: string): number | null =>
  fields.reduce<number | null>((best, field) => {
    const score = scoreText(field.text, query)
    if (score === null) return best
    const weighted = score * (field.weight ?? 1)
    return best === null || weighted > best ? weighted : best
  }, null)

// Ranks items best-first, dropping non-matches. Ties keep the input order
// (Array#sort is stable), so callers control the fallback ordering.
export const rank = <T>(
  items: T[],
  query: string,
  fieldsOf: (item: T) => Field[]
): T[] =>
  items
    .map(item => ({ item, score: scoreFields(fieldsOf(item), query) }))
    .filter((scored): scored is { item: T; score: number } => scored.score !== null)
    .sort((a, b) => b.score - a.score)
    .map(scored => scored.item)

// Only non-secret list metadata is searchable — secrets live in the encrypted
// payload and are never held in the entry list (see `lib/commands.EntryMeta`).
export const entryFields = (entry: EntryMeta): Field[] => [
  { text: entry.title, weight: 3 },
  { text: entry.urlHost, weight: 2 },
  ...entry.tags.map(tag => ({ text: tag, weight: 1 }))
]

// Entries matching `query`, best first, alphabetical within a tie.
export const searchEntries = (entries: EntryMeta[], query: string): EntryMeta[] =>
  rank([...entries].sort((a, b) => a.title.localeCompare(b.title)), query, entryFields)
