import type { Entry, EntryType } from '@/api/types'
import type { TKey } from '@/i18n'
import type { Kind } from './types'
import login from './login'
import card from './card'
import note from './note'
import identity from './identity'
import ssh from './ssh'
import apikey from './apikey'
import env from './env'

export type { Kind, Glyph } from './types'

/**
 * Every kind of secret the vault holds, in display order (pickers, filter
 * chips, the rail). This list plus one `Kind` object is the whole contract:
 * nothing else in the app enumerates the types.
 */
export const KINDS: Kind[] = [login, card, note, identity, ssh, apikey, env]

const BY_TYPE: Record<EntryType, Kind> = { login, card, note, identity, ssh, apikey, env }

export const kindOf = (type: EntryType): Kind => BY_TYPE[type]

/**
 * An entry as the webview's types describe it, from one as Rust sends it.
 *
 * Every text field on Rust's `Entry` is an `Option<String>` that is left off
 * the wire when unset, so a login saved without an email arrives with no
 * `email` key at all — where `LoginEntry` promises a string. The kind's empty
 * draft is the list of what that kind is supposed to carry, so it fills the
 * blanks and the rest of the app can read `entry.email.length` as typed.
 * `api/contract.test.ts` checks the drafts cover every field Rust may omit.
 */
export const completeEntry = (entry: Entry): Entry =>
  ({ ...kindOf(entry.type).defaults, ...entry }) as Entry

/**
 * "Add a login" / "Add a credit card": the create action, named after the kind
 * it creates. The editor sheet, the empty panes and any future surface phrase
 * it identically, so the wording lives with the registry it comes from instead
 * of drifting into a different per-surface literal on every screen.
 *
 * Returns the key, not the string — the caller has a `t` and re-renders with it.
 */
export const addLabel = (type: EntryType): TKey => kindOf(type).addLabel
