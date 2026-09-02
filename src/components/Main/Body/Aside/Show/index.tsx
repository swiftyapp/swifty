import type { EntryMeta, EntryType } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'
import Read from './Read'
import Edit from './Edit'

interface Props {
  /** Absent while creating: there is nothing saved to read yet. */
  entry?: EntryMeta
  /** The kind being created; an edit takes the entry's own. */
  type?: EntryType
  editing?: boolean
}

// The detail pane's one entry surface. The decrypt lives here rather than in
// either mode, so entering and leaving edit doesn't re-fetch the secrets and
// blank the rows on the way through.
export default function Show({ entry, type, editing }: Props) {
  // A tombstone has nothing to reveal: `reveal_entry` does not serve deleted
  // rows, so asking would only buy a rejected invoke per selection in the Trash.
  const revealed = useRevealed(entry?.deletedAt ? null : entry)
  const kindType = type ?? entry?.type

  if (!kindType) return null
  // Keyed per entry: each editing session starts from a fresh draft.
  if (editing)
    return <Edit key={entry?.id ?? 'new'} type={kindType} revealed={revealed} />
  if (!entry) return null
  return <Read entry={entry} revealed={revealed} />
}
