import { useTranslation } from 'react-i18next'
import { openGenerator } from '@/store'
import RailButton from '@/components/elements/RailButton'
import { DicesRailGlyph } from '../icons'

// The rail's door to the standalone generator — the same open as ⌘G
// (Main/useShortcuts): no apply callback, so the dialog just copies.
export default function Generator() {
  const { t } = useTranslation()
  return (
    <RailButton label={t('Generator')} onClick={() => openGenerator()} testid="generator-button">
      <DicesRailGlyph />
    </RailButton>
  )
}
