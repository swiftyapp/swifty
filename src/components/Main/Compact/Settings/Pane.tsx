import { useTranslation } from 'react-i18next'
import type { Section as Key } from '@/store/uiSlice'
import { cx } from '@/utils/cx'
import Section from '../../Sidebar/Settings/Section'
import { titleOf } from '../../Sidebar/Settings/sections'
import BackButton from '../BackButton'
import NavBar from '../NavBar'
import { TAB_BAR_CLEARANCE } from '../chrome'

/**
 * One settings section, pushed from the root.
 *
 * One level deep rather than modal: the tab bar stays up, so the scroller
 * reserves its clearance, and the way back is the shared `NavBar` carrying the
 * previous screen's name, exactly as the entry screen's row does.
 */
export default function Pane({ section, onBack }: { section: Key; onBack: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-sheet bg-list">
      <NavBar
        leading={<BackButton testid="settings-back" label={t('Settings')} onClick={onBack} />}
      />

      <div className={cx('min-h-0 flex-1 overflow-y-auto px-4 pt-1', TAB_BAR_CLEARANCE)}>
        {/* The pane names itself the way a root does — there is no room for a
            centred nav title beside a back control that already carries one. */}
        <h1 className="mb-5 truncate text-2xl font-semibold tracking-display text-text">
          {titleOf(section)}
        </h1>
        <Section section={section} />
      </div>
    </div>
  )
}
