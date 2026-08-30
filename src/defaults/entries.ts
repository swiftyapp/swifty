import type { EntryType } from '@/lib/commands'

// Editable draft used by the entry form; ids/timestamps are added on save.
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

const defaults: Record<EntryType, EntryDraft> = {
  login: {
    type: 'login',
    title: '',
    website: '',
    username: '',
    password: '',
    email: '',
    note: '',
    otp: ''
  },
  note: {
    type: 'note',
    title: '',
    note: ''
  },
  card: {
    type: 'card',
    title: '',
    number: '',
    year: '',
    month: '',
    cvc: '',
    pin: '',
    name: ''
  }
}

export default defaults
