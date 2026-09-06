import { useTranslation } from 'react-i18next'
import { setView, closeSettings } from '@/store'
import { ArchiveRailGlyph } from '../../icons'

// The Archive lost its tab: four destinations is what a thumb can aim at, and
// deleted things are not one of them. It is still a view of the vault, so the
// row leaves Settings for it rather than opening anything here.
export default function ArchiveRow() {
  const { t } = useTranslation()

  const onClick = () => {
    setView('archive')
    closeSettings()
  }

  return (
    <button
      type="button"
      data-testid="settings-archive"
      onClick={onClick}
      className="mt-5 flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-field px-3.5 text-base text-text2 transition-colors hover:text-text"
    >
      <ArchiveRailGlyph size={16} />
      {t('Archive')}
    </button>
  )
}
