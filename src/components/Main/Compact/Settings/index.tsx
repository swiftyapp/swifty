import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { APP_NAME } from '@/lib/app'
import { MONO_LABEL } from '@/components/elements/tokens'
import Section from '../../Sidebar/Settings/Section'
import Footer from '../../Sidebar/Settings/Footer'
import SyncIndicator from '../../Header/SyncIndicator'
import LockButton from '../../Header/LockButton'
import { TAB_BAR_CLEARANCE } from '../chrome'
import Sections from './Sections'
import ArchiveRow from './ArchiveRow'

// iOS's minimum touch target, for the controls the desktop chrome draws at 28px.
const TOUCH = 'h-11 w-11'

/**
 * Settings as a tab root, not an overlay: it has no close button, because the
 * tab bar is how you leave it.
 *
 * It also holds what the vanished top bar used to: the sync chip and the lock
 * button. Both have to stay one tap away on a phone — locking especially.
 * Slice 5 turns the pill strip into rows that push their pane.
 */
export default function Settings() {
  const { t } = useTranslation()
  const section = useStore(state => state.ui.settingsSection)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-list pt-[env(safe-area-inset-top)]">
      <div className="flex flex-none items-end gap-2.5 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <div className={MONO_LABEL}>{APP_NAME}</div>
          <div className="mt-1 truncate text-title font-semibold tracking-display text-text">
            {t('Settings')}
          </div>
        </div>
        <SyncIndicator className={TOUCH} />
        <LockButton className={TOUCH} />
      </div>
      <Sections />
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 ${TAB_BAR_CLEARANCE}`}>
        <Section section={section} />
        <ArchiveRow />
        <Footer />
      </div>
    </div>
  )
}
