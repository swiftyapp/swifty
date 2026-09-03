import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { filled } from '@/components/elements/fields/formats'

export const defaults: EntryDraft = {
  type: 'note',
  title: '',
  note: ''
}

export const isValid = (draft: EntryDraft): boolean =>
  filled(draft.title) && filled(draft.note)

export const primarySecret = (entry: Entry): string =>
  entry.type === 'note' ? entry.note : ''

// The body is a secret, so there is no snippet to preview; the tags
// (non-secret metadata) stand in as the secondary line when present.
export const listSubtitle = (entry: EntryMeta): string => entry.tags.join(' · ')
