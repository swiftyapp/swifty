import type { EntryType, Passkey } from '@/lib/commands'

// Editable draft used by the entry form; ids/timestamps are added on save.
// The empty draft each kind starts from lives with that kind (src/kinds).
export interface EntryDraft {
  id?: string
  type: EntryType
  title: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  password_updated_at?: string
  // Passkeys are in the union so a draft spread from a revealed login carries
  // them through the editor untouched; no form field edits them.
  [field: string]: string | string[] | Passkey[] | undefined
}
