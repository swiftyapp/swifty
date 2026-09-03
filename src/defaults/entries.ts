import type { EntryType, ExtraField, Passkey } from '@/lib/commands'

/**
 * Everything a draft key can hold. Text is what the fields type; the three list
 * shapes are the blocks that edit a whole collection at once — tags, the
 * passkeys a login carries, and the free-form extra fields.
 */
export type DraftValue = string | string[] | Passkey[] | ExtraField[]

// Editable draft used by the entry form; ids/timestamps are added on save.
// The empty draft each kind starts from lives with that kind (src/kinds).
export interface EntryDraft {
  id?: string
  type: EntryType
  title: string
  tags?: string[]
  extra?: ExtraField[]
  createdAt?: string
  updatedAt?: string
  password_updated_at?: string
  // Passkeys are in the union so a draft spread from a revealed login carries
  // them through the editor untouched; no form field edits them.
  [field: string]: DraftValue | undefined
}
