import type { Entry } from '@/lib/commands'
import { LoginGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Form from './Form'
import Details from './Details'

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
  Form,
  // The registry is keyed by type, so reaching this component at all proves the
  // entry is a login; the guard is what lets TypeScript see that too.
  Details: ({ entry }: { entry: Entry }) =>
    entry.type === 'login' ? <Details entry={entry} /> : null
}

export default login
