import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { useStore, closeSettings, setSettingsSection } from '@/store'
import Sheet from '@/components/elements/Sheet'
import Footer from './Footer'
import Section from './Section'
import { SECTIONS } from './sections'

/**
 * Settings on a phone: the same panes, with the 220px nav rail flattened into a
 * scrollable strip of section pills above them.
 */
export default function SettingsSheet() {
  const { t } = useTranslation()
  const section = useStore(state => state.ui.settingsSection)

  const strip = (
    <div className="flex flex-none gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
      {SECTIONS.map(({ key, label, Glyph }) => (
        <button
          key={key}
          type="button"
          aria-current={key === section ? 'page' : undefined}
          data-testid={`settings-nav-${key}`}
          onClick={() => setSettingsSection(key)}
          className={cx(
            'flex h-11 flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm px-3 text-base transition-colors',
            key === section ? 'bg-accent-soft text-accent' : 'text-text2'
          )}
        >
          <Glyph size={16} />
          {t(label)}
        </button>
      ))}
    </div>
  )

  return (
    <Sheet
      title={t('Settings')}
      onClose={closeSettings}
      testid="settings-modal"
      toolbar={strip}
    >
      <div className="p-5">
        <Section section={section} />
        <Footer />
      </div>
    </Sheet>
  )
}
