import { useState } from 'react'
import { shareOpen, type Entry } from '@/lib/commands'
import { saveEntry, closeReceive } from '@/store'

export interface Receive {
  link: string
  setLink: (link: string) => void
  entry: Entry | null
  error: string | null
  busy: boolean
  open: () => void
  add: () => void
}

/**
 * Receiving: a link in, a preview, and — if it is wanted — a new row of one's
 * own.
 *
 * What lands in the vault is a copy and nothing more: no back-reference to the
 * sender, no later update. `saveEntry` is the store thunk the editor saves a
 * new entry through, so the row is minted, listed, selected and queued for sync
 * by exactly the path every other new entry takes. It mints the id and the
 * timestamps from the id-less entry the backend hands back, which is why none
 * are set here.
 */
export function useReceive(): Receive {
  const [link, setLink] = useState('')
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = () => {
    const value = link.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    shareOpen(value)
      .then(setEntry)
      // Verbatim: the backend already says which of the three it is ("this is
      // not a Swifty share link", expired, revoked), and only it can tell.
      .catch(reason => setError(String(reason)))
      .finally(() => setBusy(false))
  }

  const add = () => {
    if (!entry || busy) return
    setBusy(true)
    // Spread rather than passed straight through: a draft is an open bag of
    // fields and an `Entry` is a closed interface, so it only fits as a fresh
    // object — the same step the editor takes with a revealed entry.
    saveEntry({ ...entry })
      .then(closeReceive)
      .catch(reason => {
        setError(String(reason))
        setBusy(false)
      })
  }

  return {
    link,
    setLink: value => {
      // Typing is answering the complaint, so the complaint goes.
      setError(null)
      setLink(value)
    },
    entry,
    error,
    busy,
    open,
    add
  }
}
