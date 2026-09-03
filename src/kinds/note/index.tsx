import { NoteGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const note: Kind = {
  type: 'note',
  label: 'Secure note',
  pluralLabel: 'Secure notes',
  description: 'Private text, sealed',
  addLabel: 'Add a secure note',
  untitledLabel: 'Untitled secure note',
  emptyLabel: 'No secure notes yet',
  noMatchesLabel: 'No matches for “{{query}}” in secure notes',
  Glyph: NoteGlyph,
  tint: 'note',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy note',
  listSubtitle,
  ListRow,
  Fields
}

export default note
