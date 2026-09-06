import type { EntryMeta, EntryType } from '@/lib/commands'
import Read from './Read'
import Edit from './Edit'
import { useShown } from './useShown'

interface Props {
  /** Absent while creating: there is nothing saved to read yet. */
  entry?: EntryMeta
  /** The kind being created; an edit takes the entry's own. */
  type?: EntryType
  editing?: boolean
}

// The detail pane's one entry surface. The decrypt lives in `useShown` rather
// than in either mode, so entering and leaving edit doesn't re-fetch the
// secrets and blank the rows on the way through.
export default function Show({ entry, type, editing }: Props) {
  const { kindType, current, held } = useShown(entry, type)

  if (!kindType) return null
  if (editing) {
    // Hold the pane's frame until the secrets are in hand — a tombstone never
    // gets here, so this always resolves. (`reveal_entry` refuses deleted rows;
    // `editEntry` does too.)
    if (held) return <div className="mx-auto min-h-[320px] w-full max-w-sheet" />
    // Keyed per entry: each editing session starts from a fresh draft. A new
    // entry has no id to key on, so it is keyed by its kind — choosing another
    // kind (the picker again, or a scan that recognized a different one) is a
    // different draft, not the same one with other rows on it.
    return (
      <Edit key={entry?.id ?? `new-${kindType}`} type={kindType} revealed={current} />
    )
  }
  if (!entry) return null
  return <Read entry={entry} revealed={current} />
}
