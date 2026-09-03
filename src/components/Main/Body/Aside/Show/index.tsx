import { useRef } from 'react'
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
  // The reveal is cleared in an effect, so the first render after the props
  // change still carries the previous entry's secrets. Match it to the entry in
  // hand before passing it down — a draft (no entry) never gets one at all.
  const current = revealed && entry && revealed.id === entry.id ? revealed : null
  // Once an entry's secrets have been served, the editor owns the draft: a
  // later reveal (the refetch an `updatedAt` change triggers, e.g. a sync merge
  // landing mid-edit) must not take the editor away and the draft with it.
  const served = useRef<string | undefined>(undefined)
  if (current) served.current = current.id

  if (!kindType) return null
  if (editing) {
    // The draft is seeded from the reveal, so an editor mounted before it lands
    // would discard whatever was typed in the meantime. Hold the pane's frame
    // until the secrets are in hand — a tombstone never gets here, so this
    // always resolves. (`reveal_entry` refuses deleted rows; `editEntry` does
    // too.)
    if (entry && !current && served.current !== entry.id)
      return <div className="mx-auto min-h-[320px] w-full max-w-[860px]" />
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
