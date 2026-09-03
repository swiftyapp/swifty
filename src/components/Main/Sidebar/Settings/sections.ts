import { t } from '@/i18n'
import type { TKey } from '@/i18n'
import type { Section } from '@/store/uiSlice'
import {
  RefreshGlyph,
  ShieldGlyph,
  ActivityGlyph,
  DownloadGlyph,
  GlobeGlyph
} from '../../icons'

type Glyph = (props: { size?: number }) => React.ReactElement

// The nav order, and the single source of each section's title.
export const SECTIONS: { key: Section; label: TKey; Glyph: Glyph }[] = [
  { key: 'sync', label: 'Sync & devices', Glyph: RefreshGlyph },
  { key: 'security', label: 'Security', Glyph: ShieldGlyph },
  { key: 'audit', label: 'Vault audit', Glyph: ActivityGlyph },
  { key: 'import', label: 'Import', Glyph: DownloadGlyph },
  { key: 'language', label: 'Language & region', Glyph: GlobeGlyph }
]

export const titleOf = (section: Section): string =>
  t(SECTIONS.find(item => item.key === section)?.label ?? 'Settings')
