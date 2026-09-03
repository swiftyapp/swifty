import type { TKey } from '@/i18n'
import type { EntryDraft } from '@/defaults/entries'

/**
 * What each kind of ID document is made of.
 *
 * A passport, a driving licence and a residence permit carry overlapping but
 * different sets of the same fields, so the form is data rather than markup:
 * [`FIELDS`] says how one row renders and [`TEMPLATES`] says which rows a
 * document has and which of them it cannot be saved without. `Fields`, `isValid`
 * and the type switch all read from here, so a document type is described once.
 */

export const DOC_TYPES = [
  'passport',
  'id_card',
  'driver_license',
  'residence_permit',
  'other'
] as const

export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABELS: Record<DocType, TKey> = {
  passport: 'Passport',
  id_card: 'ID card',
  driver_license: 'Driver license',
  residence_permit: 'Residence permit',
  other: 'Other document'
}

/** How one row renders. `text` is the default and carries no flag. */
interface Spec {
  label: TKey
  /** ISO `YYYY-MM-DD`, read and typed in the user's date pattern. */
  date?: boolean
  /** In the encrypted payload: masked behind a reveal toggle. */
  secret?: boolean
  /** The document's headline value, set 2xl and letter-spaced. */
  big?: boolean
  /** The multi-line body row. */
  note?: boolean
  placeholder?: string
  maxLength?: number
}

// The document number and the personal number are the two fields the vault
// encrypts (see `crypto::sensitive_values`); everything else is printed on the
// document's face and reads plainly.
const FIELDS = {
  name: { label: 'Full name', placeholder: 'ADA LOVELACE', maxLength: 70 },
  number: {
    label: 'Document number',
    secret: true,
    big: true,
    placeholder: 'X1234567',
    maxLength: 40
  },
  country: { label: 'Issuing country', placeholder: 'GBR', maxLength: 40 },
  nationality: { label: 'Nationality', placeholder: 'GBR', maxLength: 40 },
  birth_date: { label: 'Date of birth', date: true },
  sex: { label: 'Sex', placeholder: 'F', maxLength: 12 },
  issue_date: { label: 'Issued', date: true },
  expiry_date: { label: 'Expires', date: true },
  authority: { label: 'Authority', placeholder: 'HMPO', maxLength: 60 },
  personal_number: { label: 'Personal number', secret: true, maxLength: 40 },
  note: { label: 'Note', note: true }
} satisfies Record<string, Spec>

export type IdentityKey = keyof typeof FIELDS

export const specOf = (key: IdentityKey): Spec => FIELDS[key]

/** One row of a document's form. */
export interface Row {
  key: IdentityKey
  /** Blocks the save while empty — the document is not itself without it. */
  required?: true
}

// Ordered as the document reads, not as the fields were declared: what is on the
// front of a passport comes before what is stamped on it.
export const TEMPLATES: Record<DocType, Row[]> = {
  passport: [
    { key: 'name', required: true },
    { key: 'number', required: true },
    { key: 'nationality' },
    { key: 'birth_date' },
    { key: 'sex' },
    { key: 'country', required: true },
    { key: 'issue_date' },
    { key: 'expiry_date', required: true },
    { key: 'authority' },
    { key: 'personal_number' },
    { key: 'note' }
  ],
  id_card: [
    { key: 'name', required: true },
    { key: 'number', required: true },
    { key: 'country', required: true },
    { key: 'birth_date' },
    { key: 'sex' },
    { key: 'nationality' },
    { key: 'issue_date' },
    { key: 'expiry_date' },
    { key: 'authority' },
    { key: 'personal_number' },
    { key: 'note' }
  ],
  driver_license: [
    { key: 'name', required: true },
    { key: 'number', required: true },
    { key: 'country', required: true },
    { key: 'birth_date' },
    { key: 'issue_date' },
    { key: 'expiry_date', required: true },
    { key: 'authority' },
    { key: 'note' }
  ],
  residence_permit: [
    { key: 'name', required: true },
    { key: 'number', required: true },
    { key: 'country', required: true },
    { key: 'nationality' },
    { key: 'birth_date' },
    { key: 'issue_date' },
    { key: 'expiry_date', required: true },
    { key: 'authority' },
    { key: 'note' }
  ],
  other: [
    { key: 'name', required: true },
    { key: 'number', required: true },
    { key: 'country' },
    { key: 'issue_date' },
    { key: 'expiry_date' },
    { key: 'authority' },
    { key: 'note' }
  ]
}

const isDocType = (value: unknown): value is DocType =>
  typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value)

/**
 * The document type a draft is describing. An unknown or missing one reads as a
 * passport, which is what `defaults` starts from — so a draft from an import or
 * an older vault still renders a form instead of nothing.
 */
export const docTypeOf = (draft: EntryDraft): DocType =>
  isDocType(draft.doc_type) ? draft.doc_type : 'passport'

/**
 * The keys `from`'s form has that `to`'s does not. Cleared on a type switch, so
 * a row that is no longer on screen cannot save a value nobody can see.
 */
export const droppedKeys = (from: DocType, to: DocType): IdentityKey[] => {
  const kept = new Set(TEMPLATES[to].map(row => row.key))
  return TEMPLATES[from].map(row => row.key).filter(key => !kept.has(key))
}
