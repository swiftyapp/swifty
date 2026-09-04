import type { EntryType } from '@/lib/commands'
import type { TKey } from '@/i18n'
import type { Kind } from './types'
import login from './login'
import card from './card'
import note from './note'
import identity from './identity'
import ssh from './ssh'

export type { Kind, Glyph } from './types'

/**
 * Every kind of secret the vault holds, in display order (pickers, filter
 * chips, the rail). This list plus one `Kind` object is the whole contract:
 * nothing else in the app enumerates the types.
 */
export const KINDS: Kind[] = [login, card, note, identity, ssh]

const BY_TYPE: Record<EntryType, Kind> = { login, card, note, identity, ssh }

export const kindOf = (type: EntryType): Kind => BY_TYPE[type]

/**
 * "Add a login" / "Add a credit card": the create action, named after the kind
 * it creates. The editor sheet, the empty panes and any future surface phrase
 * it identically, so the wording lives with the registry it comes from instead
 * of drifting into a different per-surface literal on every screen.
 *
 * Returns the key, not the string — the caller has a `t` and re-renders with it.
 */
export const addLabel = (type: EntryType): TKey => kindOf(type).addLabel
