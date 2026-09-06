import { editEntry } from '@/store'
import type { Entry, EntryMeta } from '@/lib/commands'
import { FieldsProvider } from '@/components/elements/fields'
import { kindOf } from '@/kinds'
import Actions from './Actions'
import DeleteError from './DeleteError'
import Eyebrow from './Eyebrow'
import Favorite from './Favorite'
import Footer from './Footer'
import Identity from './Identity'
import { useDelete } from './useDelete'

interface Props {
  entry: EntryMeta
  /** The decrypted entry, or null while `revealEntry` is still in flight. */
  revealed: Entry | null
}

export default function Read({ entry, revealed }: Props) {
  const Fields = kindOf(entry.type).Fields
  const { error, remove } = useDelete(entry.id)

  return (
    // A container, so the rows inside stack label-over-value once the pane is
    // too narrow for the label column — a squeezed desktop window, and the
    // phone's screen (see fields/Row).
    <div className="@container mx-auto w-full max-w-sheet">
      {/* The eyebrow shares its line with the actions, so the title below can
          run the full content width. */}
      <div className="flex items-center justify-between gap-4">
        <Eyebrow
          entry={entry}
          revealed={revealed}
          className="flex min-w-0 flex-1 items-center gap-2 truncate whitespace-nowrap"
        />
        <div className="flex flex-none items-center gap-1.5">
          {/* A tombstone cannot be starred — Favorites lists live entries. */}
          {!entry.deletedAt && <Favorite entry={entry} />}
          <Actions entry={entry} revealed={revealed} onDelete={remove} />
        </div>
      </div>
      <Identity
        entry={entry}
        tile="h-7 w-7"
        glyph={16}
        className="mt-2 flex items-center gap-2.5"
      />

      {revealed && (
        <div className="mt-5">
          {/* No writer: every field in the set renders its read face. */}
          <FieldsProvider value={{ entry: { ...revealed }, set: null, attempted: false }}>
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
  )
}
