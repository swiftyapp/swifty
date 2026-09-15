import type { AuditItem } from '@/api/tools'

export type FlagKind = 'weak' | 'reused'

// The audit's verdict for one entry, as a single row badge. Weak wins over
// reused: a weak password is the more urgent of the two.
export const flagOf = (item?: AuditItem): FlagKind | null => {
  if (!item) return null
  if (item.isWeak) return 'weak'
  if (item.isRepeating) return 'reused'
  return null
}
