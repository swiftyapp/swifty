import { useState, useEffect } from 'react'
import { revealEntry, type Entry } from '@/lib/commands'

// Decrypt one entry's secret fields on demand, mirroring the original app: the
// whole vault is never decrypted at once, only the entry currently in view/edit.
// Takes anything carrying an id (list metadata or a full entry). Returns null
// until the reveal resolves (and for missing entries).
//
// Keyed on `updatedAt` as well as `id`: the id survives an in-place save, and a
// decrypt keyed on it alone kept serving the PRE-edit secrets to a detail pane
// that stays mounted across saves — including its "Copy password" action, which
// then copied the rotated-away password.
export function useRevealed(entry?: { id: string; updatedAt?: string } | null): Entry | null {
  const [revealed, setRevealed] = useState<Entry | null>(null)
  const id = entry?.id
  const stamp = entry?.updatedAt

  useEffect(() => {
    setRevealed(null)
    if (!id) return
    let active = true
    revealEntry(id)
      .then(e => active && setRevealed(e))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [id, stamp])

  return revealed
}
