import type { Entry } from '@/lib/commands'
import { CardGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Form from './Form'
import Details from './Details'

const card: Kind = {
  type: 'card',
  label: 'Credit card',
  pluralLabel: 'Credit cards',
  description: 'Cards & payment details',
  Glyph: CardGlyph,
  tint: 'card',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy number',
  listSubtitle,
  ListRow,
  Form,
  Details: ({ entry }: { entry: Entry }) =>
    entry.type === 'card' ? <Details entry={entry} /> : null
}

export default card
