import type { Entry } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { filled } from '@/components/elements/fields/formats'

export const defaults: EntryDraft = {
  type: 'card',
  title: '',
  number: '',
  year: '',
  month: '',
  cvc: '',
  pin: '',
  name: '',
  note: ''
}

// Cards do not require a PIN — most cards have none.
export const isValid = (draft: EntryDraft): boolean =>
  filled(draft.title) &&
  filled(draft.number) &&
  filled(draft.cvc) &&
  filled(draft.month) &&
  filled(draft.year)

export const primarySecret = (entry: Entry): string =>
  entry.type === 'card' ? entry.number : ''

// The real number is a secret, so the list shows a static masked pattern.
export const CARD_MASK = '•••• •••• •••• ••••'

export const listSubtitle = (): string => CARD_MASK
