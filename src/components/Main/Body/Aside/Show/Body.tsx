import { editEntry } from '@/store'
import type { Entry, EntryMeta } from '@/lib/commands'
import { FieldsProvider } from '@/components/elements/fields'
import { kindOf } from '@/kinds'
import DeleteError from './DeleteError'
import Footer from './Footer'

interface Props {
  entry: EntryMeta
  /** The decrypted entry, or null while `revealEntry` is still in flight. */
  revealed: Entry | null
  /** What the last delete had to say, from `useDelete`. */
  error: string | null
}

// Everything under the identity header while reading: the kind's own field set
// in its read face, the footer, and whatever the last delete had to say. The
// mirror of `Edit/Body` — neither shell adds to it, they only choose what the
// header above it looks like and where the whole thing scrolls.
export default function Body({ entry, revealed, error }: Props) {
  const Fields = kindOf(entry.type).Fields

  return (
    <>
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
    </>
  )
}
