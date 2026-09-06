import type { EntryMeta } from '@/lib/commands'
import { editEntry } from '@/store'
import { cx } from '@/utils/cx'
import { kindOf } from '@/kinds'
import { FieldsProvider } from '@/components/elements/fields'
import DeleteError from '../../Body/Aside/Show/DeleteError'
import Eyebrow from '../../Body/Aside/Show/Eyebrow'
import Footer from '../../Body/Aside/Show/Footer'
import Identity from '../../Body/Aside/Show/Identity'
import { useDelete } from '../../Body/Aside/Show/useDelete'
import { useShown } from '../../Body/Aside/Show/useShown'
import { PRIMARY_CLEARANCE } from '../chrome'
import NavRow from './NavRow'
import PrimaryAction from './PrimaryAction'

/**
 * Reading one entry, on a phone: a nav row, the entry's own identity at the
 * size a 390px screen can afford, the kind's field set, the footer, and the
 * primary action pinned where a thumb is.
 *
 * Every part below the nav row is the desktop's, unchanged. What differs is
 * where they are placed and how much room they have — the scroller declares
 * itself a `@container`, and the rows fold themselves (see fields/Row).
 */
export default function Read({ entry }: { entry: EntryMeta }) {
  const { current } = useShown(entry)
  const { error, remove } = useDelete(entry.id)
  const Fields = kindOf(entry.type).Fields

  return (
    // `relative`: what the bottom action and its fade are pinned to.
    <div className="relative flex min-h-0 flex-1 flex-col animate-sheet bg-detail text-text">
      <NavRow entry={entry} onDelete={remove} />

      <div
        className={cx(
          '@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1',
          PRIMARY_CLEARANCE
        )}
      >
        {/* The screen has no title bar, so the entry names itself here — a
            60px tile beside the title, with the eyebrow over it. */}
        <Identity
          entry={entry}
          tile="h-[60px] w-[60px]"
          glyph={28}
          className="flex items-center gap-3.5"
        >
          <Eyebrow
            entry={entry}
            revealed={current}
            className="mb-1 flex items-center gap-2 truncate whitespace-nowrap"
          />
        </Identity>

        {current && (
          <div className="mt-5">
            {/* No writer: every field in the set renders its read face. */}
            <FieldsProvider value={{ entry: { ...current }, set: null, attempted: false }}>
              <Fields />
            </FieldsProvider>
          </div>
        )}

        {/* Tags are metadata, so the footer needs no reveal to render. */}
        <Footer
          tags={entry.tags}
          onAdd={entry.deletedAt ? undefined : () => editEntry()}
          createdAt={entry.createdAt}
          updatedAt={entry.updatedAt}
          deletedAt={entry.deletedAt}
        />

        <DeleteError error={error} />
      </div>

      {/* `reveal_entry` does not serve deleted rows, so a tombstone has no
          secret to offer and nothing to offer it with. */}
      {!entry.deletedAt && <PrimaryAction entry={entry} revealed={current} />}
    </div>
  )
}
