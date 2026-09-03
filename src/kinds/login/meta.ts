import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { emailError, filled } from '@/components/elements/fields/formats'

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
  filled(draft.title) &&
  filled(draft.username) &&
  filled(draft.password) &&
  // The email is optional, but the row's "Not an email address" complaint is
  // binding: showing it in red and saving anyway is not a check.
  (!filled(draft.email) || !emailError(draft.email))

export const primarySecret = (entry: Entry): string =>
  entry.type === 'login' ? entry.password : ''

// The site's own host stands in for the account — the username is a secret.
export const listSubtitle = (entry: EntryMeta): string => entry.urlHost
