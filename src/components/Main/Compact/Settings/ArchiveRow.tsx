import { useTranslation } from 'react-i18next'
import { setView, closeSettings } from '@/store'
import { ArchiveRailGlyph } from '../../icons'
import Row from './Row'

// The Archive lost its tab: four destinations is what a thumb can aim at, and
// deleted things are not one of them. It is still a view of the vault, so the
// row leaves Settings for it rather than opening anything here — which is why
// it sits in a card of its own, away from the sections that push a pane.
export default function ArchiveRow() {
  const { t } = useTranslation()

  const onClick = () => {
    setView('archive')
    closeSettings()
  }

  return (
    <Row
      testid="settings-archive"
      label={t('Archive')}
      glyph={<ArchiveRailGlyph size={16} />}
      onClick={onClick}
    />
  )
}
