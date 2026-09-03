import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { filled } from '@/components/elements/fields/formats'
import { docTypeOf, TEMPLATES } from './templates'

export const defaults: EntryDraft = {
  type: 'identity',
  title: '',
  doc_type: 'passport',
  name: '',
  number: '',
  country: '',
  nationality: '',
  birth_date: '',
  sex: '',
  issue_date: '',
  expiry_date: '',
  authority: '',
  personal_number: '',
  note: ''
}

// What "complete" means depends on the document: a driving licence must have an
// expiry date, an ID card need not. The template is the single answer, so the
// rows' own "Required" marks and the save agree by construction.
export const isValid = (draft: EntryDraft): boolean =>
  filled(draft.title) &&
  TEMPLATES[docTypeOf(draft)]
    .filter(row => row.required)
    .every(row => filled(draft[row.key]))

export const primarySecret = (entry: Entry): string =>
  entry.type === 'identity' ? entry.number : ''

// The document number is a secret and the document type is in the encrypted
// payload, so there is nothing about the document itself to show here; the tags
// (non-secret metadata) stand in as the secondary line when present.
export const listSubtitle = (entry: EntryMeta): string => entry.tags.join(' · ')
