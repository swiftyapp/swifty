import { useTranslation } from 'react-i18next'
import {
  useStore,
  setView,
  openGenerator,
  openSettings,
  closeSettings,
  closeGenerator
} from '@/store'
import type { View } from '@/store/uiSlice'
import { DicesRailGlyph, GearRailGlyph, GridRailGlyph, StarRailGlyph } from '../icons'
import { TAB_BAR } from './chrome'
import Tab from './Tab'

/**
 * The phone's root navigation: a floating glass pill the content scrolls under.
 *
 * Four destinations — the two everyday lists, the generator and settings. The
 * Archive is not one of them: it is where deleted things go, not somewhere you
 * spend a thumb, so it moved into Settings. The tag filter is not here either —
 * it narrows the list it sits above rather than navigating, so it lives in the
 * list header.
 *
 * Nothing here is new state: which tab is lit is read back off the store, and
 * a list tab closes whatever root is over it so the tap really navigates.
 */
export default function TabBar() {
  const { t } = useTranslation()
  const view = useStore(state => state.ui.view)
  const settings = useStore(state => state.ui.settings)
  // The standalone generator only. Opened from a password row it carries an
  // apply callback and is an overlay over the form, not a root.
  const generator = useStore(
    state => state.generator.open && !state.generator.apply && !state.generator.ssh
  )

  const list = (next: View) => () => {
    closeSettings()
    closeGenerator()
    setView(next)
  }
  const onList = (next: View) => !settings && !generator && view === next

  return (
    <>
      {/* Rows dissolve into the ground under the bar rather than sliding behind
          a hard edge. Purely decorative, so it never eats a tap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-b from-transparent to-app"
      />
      <nav
        data-testid="tab-bar"
        className={`absolute z-10 grid grid-cols-4 items-center rounded-full border border-line2 bg-glass px-1.5 shadow-float backdrop-blur-xl ${TAB_BAR}`}
      >
        <Tab
          label={t('All Items')}
          testid="tab-items"
          selected={onList('items')}
          onClick={list('items')}
        >
          <GridRailGlyph />
        </Tab>
        <Tab
          label={t('Favorites')}
          testid="tab-favorites"
          selected={onList('favorites')}
          onClick={list('favorites')}
        >
          <StarRailGlyph />
        </Tab>
        <Tab
          label={t('Generator')}
          testid="tab-generator"
          selected={generator}
          onClick={() => openGenerator()}
        >
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
    </>
  )
}
