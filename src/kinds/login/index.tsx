import { LoginGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const login: Kind = {
  type: 'login',
  label: 'Login',
  pluralLabel: 'Logins',
  description: 'Passwords for apps & sites',
  Glyph: LoginGlyph,
  tint: 'login',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy password',
  listSubtitle,
  ListRow,
  Fields
}

export default login
