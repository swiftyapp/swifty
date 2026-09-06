import type { Entry, EntryType } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { FieldsProvider } from '@/components/elements/fields'
import Footer from '../Footer'
import type { Draft } from './useDraft'

interface Props {
  draft: Draft
  /** The kind being written: a new entry's chosen kind, or the entry's own. */
  type: EntryType
  /** The decrypted entry, or null for a new one. Only its stamps are read here. */
  revealed: Entry | null
}

// Everything under the title while writing: the kind's own field set, the
// footer with its tags open, and whatever the last save had to say. Neither
// shell adds to it — they only choose what the title above it looks like.
export default function Body({ draft, type, revealed }: Props) {
  const Fields = kindOf(type).Fields
  // A draft array is not necessarily strings (a login also carries passkeys),
  // so narrow rather than assume the key holds tags.
  const raw = draft.model.tags
  const tags = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []

  return (
    <>
      <div className="mt-5">
        <FieldsProvider
          value={{ entry: draft.model, set: draft.set, attempted: draft.attempted }}
        >
          <Fields />
        </FieldsProvider>
      </div>

      {/* The read view's footer, with the tags open for editing. A new entry
          has no dates yet, so its footer is the tags cell alone. */}
      <Footer
        tags={tags}
        onTags={next => draft.set('tags', next)}
        createdAt={revealed?.createdAt ?? revealed?.created_at}
        updatedAt={revealed?.updatedAt ?? revealed?.updated_at}
      />

      {draft.saveError && (
        <div
          data-testid="entry-save-error"
          className="mt-4 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad"
        >
          {draft.saveError}
        </div>
      )}
    </>
  )
}
