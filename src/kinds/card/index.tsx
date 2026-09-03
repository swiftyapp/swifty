import { CardGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const card: Kind = {
  type: 'card',
  label: 'Credit card',
  pluralLabel: 'Credit cards',
  description: 'Cards & payment details',
  addLabel: 'Add a credit card',
  untitledLabel: 'Untitled credit card',
  emptyLabel: 'No credit cards yet',
  noMatchesLabel: 'No matches for “{{query}}” in credit cards',
  Glyph: CardGlyph,
  tint: 'card',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy number',
  listSubtitle,
  ListRow,
  Fields
}

export default card
