import { useTranslation } from 'react-i18next'
import { useStore, setNoEntry } from '@/store'
import IconButton from '@/components/elements/IconButton'
import DetailPane from '../Body/DetailPane'
import { BackGlyph } from '../icons'

/**
 * The pushed screen — an entry being read, written or created.
 *
 * Interim: it is the wide shell's detail pane with a back control over it and
 * the phone's gutters, which keeps every kind functional until slice 3 gives
 * reading its own nav row and slice 4 gives writing its own form.
 */
export default function Detail() {
  const { t } = useTranslation()
  // A draft leaves through the editor's own Cancel, which guards unsaved
  // changes. A second way out up here would be an unguarded one.
  const writing = useStore(state => state.entries.edit || state.entries.new !== null)

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-sheet bg-detail">
      <header className="flex flex-none items-center px-2 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center">
          {!writing && (
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
      </header>
      {/* 16px of gutter a side, and room under the content for a thumb. */}
      <DetailPane className="px-4 pt-4 pb-10" />
    </div>
  )
}
