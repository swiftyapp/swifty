import { EnvGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const env: Kind = {
  type: 'env',
  label: 'Env file',
  pluralLabel: 'Env files',
  description: '.env files & variables',
  addLabel: 'Add an env file',
  untitledLabel: 'Untitled env file',
  emptyLabel: 'No env files yet',
  noMatchesLabel: 'No matches for “{{query}}” in env files',
  Glyph: EnvGlyph,
  tint: 'env',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy .env',
  listSubtitle,
  ListRow,
  Fields
}

export default env
