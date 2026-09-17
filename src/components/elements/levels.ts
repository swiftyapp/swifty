// The 0–4 level scale shared by the strength bar and the generator's entropy
// readout: a fill for each meter segment and matching ink for its label.
import type { TKey } from '@/i18n'

/** What each zxcvbn score is called; indexed like `LEVEL_FILL` and `LEVEL_INK`. */
export const LEVEL_LABELS: TKey[] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

export const LEVEL_FILL = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-good', 'bg-good']

export const LEVEL_INK = [
  'text-bad',
  'text-bad',
  'text-warn',
  'text-good',
  'text-good'
]
