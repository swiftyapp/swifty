import { useState } from 'react'
import type { Entry, EntryMeta, EntryType } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'

export interface Shown {
  /** The kind on screen: the one being created, or the entry's own. */
  kindType?: EntryType
  /** The decrypted entry, matched to the entry in hand, or null. */
  current: Entry | null
  /**
   * The secrets have never landed for this entry. An editor seeded from a
   * reveal that has not arrived would discard whatever is typed meanwhile, so
   * the surface holds its frame instead of mounting one.
   */
  held: boolean
}

/**
 * The decrypt behind an entry surface, in one place, so entering and leaving
 * edit doesn't re-fetch the secrets and blank the rows on the way through.
 *
 * A tombstone has nothing to reveal: `reveal_entry` does not serve deleted
 * rows, so asking would only buy a rejected invoke per selection in the Archive.
 */
export function useShown(entry?: EntryMeta, type?: EntryType): Shown {
  const revealed = useRevealed(entry?.deletedAt ? null : entry)
  // The reveal is cleared in an effect, so the first render after the props
  // change still carries the previous entry's secrets. Match it to the entry in
  // hand before handing it on — a draft (no entry) never gets one at all.
  const current = revealed && entry && revealed.id === entry.id ? revealed : null
  // Once an entry's secrets have been served, the editor owns the draft: a
  // later reveal (the refetch an `updatedAt` change triggers, e.g. a sync merge
  // landing mid-edit) must not take the editor away and the draft with it.
  //
  // State adjusted during render rather than a ref, which is what a render pass
  // React throws away (StrictMode, a concurrent re-render) would leave stamped
  // with an entry that was never shown. `held` is only read when there is no
  // `current`, and only written when there is one, so the extra pass this
  // schedules never changes what the same render returns.
  const [served, setServed] = useState<string | undefined>(undefined)
  if (current && served !== current.id) setServed(current.id)

  return {
    kindType: type ?? entry?.type,
    current,
    held: !!entry && !current && served !== entry.id
  }
}
