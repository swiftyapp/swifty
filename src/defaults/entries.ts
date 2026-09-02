import type { EntryType } from '@/lib/commands'

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
  [field: string]: string | string[] | undefined
}
