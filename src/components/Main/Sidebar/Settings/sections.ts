import { t } from '@/i18n'
import type { TKey } from '@/i18n'
import type { Section } from '@/store'
import {
  GeneralGlyph,
  ShieldGlyph,
  ActivityGlyph,
  LayersGlyph,
  CloudGlyph,
  TransferGlyph
} from '../../icons'

type Glyph = (props: { size?: number }) => React.ReactElement

export type Group = 'app' | 'vault' | 'data'

// The wide nav's headings, in order. The compact shell lists the sections flat.
export const GROUPS: { key: Group; label: TKey }[] = [
  { key: 'app', label: 'App' },
  { key: 'vault', label: 'Vault' },
  { key: 'data', label: 'Data' }
]

// The nav order, and the single source of each section's title and the line
// under it. Flat, and already in group order, so a flat list reads the same.
export const SECTIONS: {
  key: Section
  group: Group
  label: TKey
  description: TKey
  Glyph: Glyph
}[] = [
  {
    key: 'language',
    group: 'app',
    label: 'General',
    description: 'Appearance, language and how dates are shown.',
    Glyph: GeneralGlyph
  },
  {
    key: 'security',
    group: 'vault',
    label: 'Security',
    description: 'How your vault unlocks, locks itself and generates passwords.',
    Glyph: ShieldGlyph
  },
  {
    key: 'audit',
    group: 'vault',
    label: 'Vault audit',
    description: 'Continuous checks for weak, reused and breached passwords.',
    Glyph: ActivityGlyph
  },
  {
    key: 'workspaces',
    group: 'vault',
    label: 'Workspaces',
    description: 'Separate encrypted vaults that open with one master password.',
    Glyph: LayersGlyph
  },
  {
    key: 'sync',
    group: 'data',
    label: 'Sync & backup',
    description: 'Keep devices in step through Google Drive, and keep an offline copy.',
    Glyph: CloudGlyph
  },
  {
    key: 'import',
    group: 'data',
    label: 'Import & export',
    description: 'Bring secrets in from another manager, or take them with you.',
    Glyph: TransferGlyph
  }
]

const find = (section: Section) => SECTIONS.find(item => item.key === section)

export const titleOf = (section: Section): string => t(find(section)?.label ?? 'Settings')

export const descriptionOf = (section: Section): string => {
  const description = find(section)?.description
  return description ? t(description) : ''
}
