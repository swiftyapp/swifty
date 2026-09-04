import type { Entry, EntryMeta } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { filled } from '@/components/elements/fields/formats'

export const defaults: EntryDraft = {
  type: 'ssh',
  title: '',
  privateKey: '',
  publicKey: '',
  fingerprint: '',
  passphrase: '',
  note: ''
}

export const isValid = (draft: EntryDraft): boolean =>
  filled(draft.title) && filled(draft.privateKey)

export const primarySecret = (entry: Entry): string =>
  entry.type === 'ssh' ? entry.privateKey : ''

// Both halves of the key are in the payload — even the public one, since it
// names the machine it belongs to — so, as with a note, the tags are the only
// secondary line the list can draw without a reveal.
export const listSubtitle = (entry: EntryMeta): string => entry.tags.join(' · ')
