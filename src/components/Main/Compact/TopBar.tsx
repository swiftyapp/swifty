import { useTranslation } from 'react-i18next'
import { useStore, setNoEntry } from '@/store'
import IconButton from '@/components/elements/IconButton'
import SyncIndicator from '../Header/SyncIndicator'
import LockButton from '../Header/LockButton'
import { BackGlyph } from '../icons'

/**
 * The compact top chrome. No drag region and no traffic-light gutter — there is
 * no window to move — but it does pad itself past the notch.
 */
export default function TopBar({ detail }: { detail: boolean }) {
  const { t } = useTranslation()
  // A draft leaves through the editor's own Cancel, which guards unsaved
  // changes. A second way out up here would be an unguarded one.
  const writing = useStore(state => state.entries.edit || state.entries.new !== null)

  return (
    <header className="flex flex-none items-center gap-1.5 border-b border-line bg-chrome px-2 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 flex-1 items-center">
        {detail && !writing && (
          <IconButton
            testid="compact-back"
            label={t('Back')}
            onClick={setNoEntry}
            className="h-11 w-11"
          >
            <BackGlyph />
          </IconButton>
        )}
      </div>
      <SyncIndicator />
      <LockButton />
    </header>
  )
}
