import { IdentityGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const identity: Kind = {
  type: 'identity',
  label: 'Identity',
  pluralLabel: 'Identities',
  description: 'Passports, ID cards & licenses',
  addLabel: 'Add an identity',
  untitledLabel: 'Untitled identity',
  emptyLabel: 'No identities yet',
  noMatchesLabel: 'No matches for “{{query}}” in identities',
  Glyph: IdentityGlyph,
  tint: 'identity',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy number',
  listSubtitle,
  ListRow,
  Fields
}

export default identity
