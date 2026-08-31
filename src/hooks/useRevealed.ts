import { useState, useEffect } from 'react'
import { revealEntry, type Entry } from '@/lib/commands'

// Decrypt one entry's secret fields on demand, mirroring the original app: the
// whole vault is never decrypted at once, only the entry currently in view/edit.
// Returns null until the reveal resolves (and for missing entries).
export function useRevealed(entry?: Entry | null): Entry | null {
  const [revealed, setRevealed] = useState<Entry | null>(null)
  const id = entry?.id

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
  }, [id])

  return revealed
}
