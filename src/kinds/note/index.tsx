import type { Entry } from '@/lib/commands'
import { NoteGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Form from './Form'
import Details from './Details'

const note: Kind = {
  type: 'note',
  label: 'Secure note',
  pluralLabel: 'Secure notes',
  description: 'Private text, sealed',
  Glyph: NoteGlyph,
  tint: 'note',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy note',
  listSubtitle,
  ListRow,
  Form,
  Details: ({ entry }: { entry: Entry }) =>
    entry.type === 'note' ? <Details entry={entry} /> : null
}

export default note
