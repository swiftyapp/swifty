import { useTranslation } from 'react-i18next'
import { useStore, setSettingsSection } from '@/store'
import { cx } from '@/utils/cx'
import { SECTIONS } from '../../Sidebar/Settings/sections'

// The 220px desktop nav rail, flattened into a scrollable strip of pills above
// the pane it switches. Slice 5 turns these into rows that push their pane.
export default function Sections() {
  const { t } = useTranslation()
  const section = useStore(state => state.ui.settingsSection)

  return (
    <div className="flex flex-none gap-1.5 overflow-x-auto px-4 pt-3 pb-1">
      {SECTIONS.map(({ key, label, Glyph }) => (
        <button
          key={key}
          type="button"
          aria-current={key === section ? 'page' : undefined}
          data-testid={`settings-nav-${key}`}
          onClick={() => setSettingsSection(key)}
          className={cx(
            'flex h-11 flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-base transition-colors',
            key === section ? 'bg-accent-soft text-accent' : 'bg-field text-text2'
          )}
        >
          <Glyph size={16} />
          {t(label)}
        </button>
      ))}
    </div>
  )
}
