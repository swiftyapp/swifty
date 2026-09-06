import { useTranslation } from 'react-i18next'
import type { EntryMeta } from '@/lib/commands'
import { editEntry, setNoEntry } from '@/store'
import Archived from '../../Body/Aside/Show/Archived'
import Favorite from '../../Body/Aside/Show/Favorite'
import MoreMenu from '../../Body/Aside/Show/MoreMenu'
import { useListTitle } from '../../Body/ListColumn/useListTitle'
import { BackGlyph } from '../../icons'

// The iOS 44px minimum, for controls the desktop header draws at 28px.
const TOUCH = 'h-11 w-11'

/**
 * The pushed screen's nav row: 56px over the safe area, with the way back on
 * the left and the entry's actions on the right.
 *
 * The back control carries the *previous* screen's name rather than the word
 * "Back" — the same title the list root shows, from the same hook, so the two
 * can never disagree about where this screen was pushed from.
 */
export default function NavRow({
  entry,
  onDelete
}: {
  entry: EntryMeta
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const from = useListTitle()

  return (
    <header className="flex flex-none items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        data-testid="compact-back"
        onClick={setNoEntry}
        className="flex h-14 min-w-11 cursor-pointer items-center gap-0.5 pr-2 text-accent"
      >
        <BackGlyph />
        <span className="max-w-[160px] truncate text-md">{from}</span>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        {/* A tombstone has no star, no editor and no menu — only Restore and
            the last delete, which is exactly what the desktop offers too. */}
        {entry.deletedAt ? (
          <Archived entry={entry} />
        ) : (
          <>
            <Favorite entry={entry} className={TOUCH} />
            <button
              type="button"
              data-testid="edit-entry-button"
              onClick={() => editEntry()}
              className="flex h-11 cursor-pointer items-center px-2 text-md text-accent"
            >
              {t('Edit')}
            </button>
            {/* Under the trigger rather than 32px down from its top: the nav
                row's button is 44px tall, not 28px. */}
            <MoreMenu onDelete={onDelete} className={TOUCH} menu="right-0 top-full mt-1" />
          </>
        )}
      </div>
    </header>
  )
}
