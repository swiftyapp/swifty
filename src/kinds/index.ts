import type { EntryType } from '@/lib/commands'
import type { Kind } from './types'
import login from './login'
import card from './card'
import note from './note'

export type { Kind, FormProps, Glyph } from './types'

/**
 * Every kind of secret the vault holds, in display order (pickers, filter
 * chips, the rail). This list plus one `Kind` object is the whole contract:
 * nothing else in the app enumerates the types.
 */
export const KINDS: Kind[] = [login, card, note]

const BY_TYPE: Record<EntryType, Kind> = { login, card, note }

export const kindOf = (type: EntryType): Kind => BY_TYPE[type]
