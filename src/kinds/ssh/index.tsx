import { SshGlyph } from '@/components/Main/icons'
import type { Kind } from '../types'
import { defaults, isValid, listSubtitle, primarySecret } from './meta'
import ListRow from './ListRow'
import Fields from './Fields'

const ssh: Kind = {
  type: 'ssh',
  label: 'SSH key',
  pluralLabel: 'SSH keys',
  description: 'Keys for servers & Git',
  addLabel: 'Add an SSH key',
  untitledLabel: 'Untitled SSH key',
  emptyLabel: 'No SSH keys yet',
  noMatchesLabel: 'No matches for “{{query}}” in SSH keys',
  Glyph: SshGlyph,
  tint: 'ssh',
  defaults,
  isValid,
  primarySecret,
  primaryActionLabel: 'Copy private key',
  listSubtitle,
  ListRow,
  Fields
}

export default ssh
