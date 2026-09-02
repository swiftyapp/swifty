import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'

export const defaults: EntryDraft = {
  type: 'login',
  title: '',
  website: '',
  username: '',
  password: '',
  email: '',
  note: '',
  otp: ''
}

export const isValid = (draft: EntryDraft): boolean =>
  !!(draft.title && draft.username && draft.password)

export const primarySecret = (entry: Entry): string =>
  entry.type === 'login' ? entry.password : ''

// The site's own host stands in for the account — the username is a secret.
export const listSubtitle = (entry: EntryMeta): string => entry.urlHost
