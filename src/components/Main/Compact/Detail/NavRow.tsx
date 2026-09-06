import { useTranslation } from 'react-i18next'
import type { EntryMeta } from '@/lib/commands'
import { editEntry, setNoEntry } from '@/store'
import Archived from '../../Body/Aside/Show/Archived'
import Favorite from '../../Body/Aside/Show/Favorite'
import MoreMenu from '../../Body/Aside/Show/MoreMenu'
import { useListTitle } from '../../Body/ListColumn/useListTitle'
import BackButton from '../BackButton'
import NavBar from '../NavBar'
import { TOUCH } from '../chrome'

/**
 * The read screen's nav row: the way back on the left, the entry's actions on
 * the right, no centred title — the entry names itself in the header below.
 *
 * The back control carries the *previous* screen's name rather than the word
 * "Back", from the same hook the list root draws its title with, so the two can
 * never disagree about where this screen was pushed from.
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
    <NavBar
      leading={<BackButton testid="compact-back" label={from} onClick={setNoEntry} />}
      trailing={
        // A tombstone has no star, no editor and no menu — only Restore and
        // the last delete, which is exactly what the desktop offers too.
        entry.deletedAt ? (
          // The desktop's 28px control tier is under the touch minimum, so the
          // pair is raised to the 44px one the rest of this row sits at.
          <Archived entry={entry} className="h-11" />
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
        )
      }
    />
  )
}
