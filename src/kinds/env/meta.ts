import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { filled } from '@/components/elements/fields/formats'

export const defaults: EntryDraft = {
  type: 'env',
  title: '',
  body: '',
  fileName: '',
  note: ''
}

// The file is the one thing an env entry is; a name without a body has nothing
// to copy or hand back out. The file name is optional — a pasted file has none.
export const isValid = (draft: EntryDraft): boolean =>
  filled(draft.title) && filled(draft.body)

// "Copy .env": the whole file, since one variable is a row's own copy button
// and the file is what a new machine needs.
export const primarySecret = (entry: Entry): string =>
  entry.type === 'env' ? entry.body : ''

// The body is in the payload, so until the file name and variable count are
// stamped into the metadata at save time (a later PR, the way the card brand
// is) the tags are the only secondary line the list can draw without a reveal.
export const listSubtitle = (entry: EntryMeta): string => entry.tags.join(' · ')
