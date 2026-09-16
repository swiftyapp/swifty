import { useState, useEffect } from 'react'
import type { Entry } from '@/api/types'
import { revealEntry } from '@/api/vault'
import { completeEntry } from '@/kinds'

export interface Revealed {
  /** The decrypted entry, or null until the reveal resolves (and for missing entries). */
  entry: Entry | null
  /** The reveal was refused or failed; nothing will arrive until `retry`. */
  failed: boolean
  /** Ask again, for the surface that shows the failure. */
  retry: () => void
}

// Decrypt one entry's secret fields on demand, mirroring the original app: the
// whole vault is never decrypted at once, only the entry currently in view/edit.
// Takes anything carrying an id (list metadata or a full entry).
//
// Keyed on `updatedAt` as well as `id`: the id survives an in-place save, and a
// decrypt keyed on it alone kept serving the PRE-edit secrets to a detail pane
// that stays mounted across saves — including its "Copy password" action, which
// then copied the rotated-away password.
//
// A failure is reported rather than swallowed: a rejected reveal used to leave
// the pane looking like one still loading, with nothing to read and no way out.
export function useRevealed(entry?: { id: string; updatedAt?: string } | null): Revealed {
  const [revealed, setRevealed] = useState<Entry | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const id = entry?.id
  const stamp = entry?.updatedAt

  useEffect(() => {
    setRevealed(null)
    setFailed(false)
    if (!id) return
    let active = true
    revealEntry(id)
      .then(e => active && setRevealed(completeEntry(e)))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [id, stamp, attempt])

  return { entry: revealed, failed, retry: () => setAttempt(n => n + 1) }
}
