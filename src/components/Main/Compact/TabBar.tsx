import { useTranslation } from 'react-i18next'
import { useStore, setView, openGenerator, openSettings } from '@/store'
import {
  ArchiveRailGlyph,
  DicesRailGlyph,
  GearRailGlyph,
  GridRailGlyph,
  StarRailGlyph
} from '../icons'
import Tab from './Tab'

/**
 * The compact replacement for the 56px rail: the three views plus the two
 * things the rail's bottom held. The tag filter is not here — it narrows the
 * list it sits above rather than navigating, so it moved into the list header.
 */
export default function TabBar() {
  const { t } = useTranslation()
  const view = useStore(state => state.ui.view)
  const settings = useStore(state => state.ui.settings)

  return (
    <nav
      data-testid="tab-bar"
      className="flex flex-none items-stretch border-t border-line bg-rail pb-[env(safe-area-inset-bottom)]"
    >
      <Tab
        label={t('All Items')}
        testid="tab-items"
        selected={view === 'items'}
        onClick={() => setView('items')}
      >
        <GridRailGlyph />
      </Tab>
      <Tab
        label={t('Favorites')}
        testid="tab-favorites"
        selected={view === 'favorites'}
        onClick={() => setView('favorites')}
      >
        <StarRailGlyph />
      </Tab>
      <Tab
        label={t('Archive')}
        testid="tab-archive"
        selected={view === 'archive'}
        onClick={() => setView('archive')}
      >
        <ArchiveRailGlyph />
      </Tab>
      <Tab label={t('Generator')} testid="tab-generator" onClick={() => openGenerator()}>
        <DicesRailGlyph />
      </Tab>
      <Tab
        label={t('Settings')}
        testid="tab-settings"
        selected={settings}
        onClick={() => openSettings()}
      >
        <GearRailGlyph />
      </Tab>
    </nav>
  )
}
