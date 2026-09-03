import type { ComponentType } from 'react'
import type { TKey } from '@/i18n'
import type { Entry, EntryMeta, EntryType } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import type { LoginGlyph } from '@/components/Main/icons'
import type { ContentProps } from '@/components/Main/Body/List/Item/Row'

// Every icon in the set shares this signature (see Main/icons.tsx).
export type Glyph = typeof LoginGlyph

/**
 * Everything the app needs to know about one kind of secret, in one object.
 *
 * Adding a kind means writing one of these and listing it in `KINDS` — no
 * switch statement, glyph map or label record anywhere else has to learn
 * about it.
 */
export interface Kind {
  type: EntryType
  /** Singular, untranslated — call sites wrap it in `t()`. */
  label: TKey
  /** Plural, untranslated (list-column title, filter chip). */
  pluralLabel: TKey
  /** One line for pickers and empty states. */
  description: TKey
  /**
   * Whole sentences rather than a template plus a spliced noun. Languages that
   * inflect (ru, uk, pl) cannot take a nominative noun dropped into a slot, so
   * each kind names its own phrasing and the translator gets a full sentence.
   */
  addLabel: TKey
  untitledLabel: TKey
  emptyLabel: TKey
  noMatchesLabel: TKey
  Glyph: Glyph
  /** Key into the `--color-kind-*` tokens (see styles/theme.css). */
  tint: 'login' | 'card' | 'note'
  /** The empty draft a new entry of this kind starts from. */
  defaults: EntryDraft
  /** Whether a draft carries the fields this kind requires to be saved. */
  isValid: (draft: EntryDraft) => boolean
  /** The one secret worth a shortcut — what ⏎ and ⌘⏎ copy. */
  primarySecret: (entry: Entry) => string
  /** Untranslated label for the detail header's primary button. */
  primaryActionLabel: TKey
  /** The row's secondary line, from non-secret metadata only. */
  listSubtitle: (entry: EntryMeta) => string
  ListRow: ComponentType<ContentProps>
  /**
   * The kind's field set — the read view AND the editor. It takes no props:
   * the draft, the writer and the save-attempt flag all arrive through the
   * `FieldsProvider` its rows read (see components/elements/fields).
   */
  Fields: ComponentType
}
