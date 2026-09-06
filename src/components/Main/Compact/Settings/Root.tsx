import { useTranslation } from 'react-i18next'
import { lockVault } from '@/store'
import type { Section } from '@/store/uiSlice'
import { CARD } from '@/components/elements/tokens'
import { cx } from '@/utils/cx'
import { SECTIONS } from '../../Sidebar/Settings/sections'
import Footer from '../../Sidebar/Settings/Footer'
import SyncIndicator from '../../Header/SyncIndicator'
import { LockGlyph } from '../../icons'
import { TAB_BAR_CLEARANCE } from '../chrome'
import Heading from '../Heading'
import Row from './Row'
import ArchiveRow from './ArchiveRow'

/**
 * The Settings root: the desktop's 220px nav rail as a list of rows that push
 * their pane, the way an iOS settings screen reads.
 *
 * It also holds what the vanished top bar used to. The sync chip rides in the
 * title row because it is a status pill; locking is a row of its own, in the
 * warning ink, because it ends the session and should look like it.
 */
export default function Root({ onSelect }: { onSelect: (section: Section) => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-list pt-[env(safe-area-inset-top)]">
      <div className="flex flex-none items-end gap-2.5 px-4 pt-4">
        <Heading title={t('Settings')} />
        <SyncIndicator className="h-11 w-11" />
      </div>

      <div className={cx('min-h-0 flex-1 overflow-y-auto px-4 pt-5', TAB_BAR_CLEARANCE)}>
        <div className={CARD}>
          {SECTIONS.map(({ key, label, Glyph }) => (
            <Row
              key={key}
              testid={`settings-nav-${key}`}
              label={t(label)}
              glyph={<Glyph size={16} />}
              chevron
              onClick={() => onSelect(key)}
            />
          ))}
        </div>

        <div className={cx(CARD, 'mt-5')}>
          <ArchiveRow />
        </div>

        {/* The one place to lock on a phone: the top chrome that used to carry
            the button is gone, and the palette that carries the command is not
            reachable without a keyboard. */}
        <div className={cx(CARD, 'mt-5')}>
          <Row
            testid="lock-vault-button"
            label={t('Lock vault')}
            glyph={<LockGlyph size={16} />}
            ink="text-bad"
            onClick={() => void lockVault()}
          />
        </div>

        <Footer />
      </div>
    </div>
  )
}
