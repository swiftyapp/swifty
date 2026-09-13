import { useEffect, useRef, useState } from 'react'
import { shareOpen, type Entry } from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
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
 * What a sender is not allowed to decide about a row in someone else's vault:
 * who it is (`id`), how long it has been there (the timestamps), whether it is
 * starred, and the credentials only the device that made them can use
 * (`passkeys`). Everything else is the secret that was actually shared.
 */
const NOT_THEIRS_TO_SEND = [
  'id',
  'createdAt',
  'updatedAt',
  'password_updated_at',
  'favorite',
  'passkeys'
] as const

/**
 * Strip an unsealed entry down to a draft. The backend sanitizes on receipt too,
 * but a share is bytes a stranger wrote: dropping the id here is what makes
 * `buildEntry` mint a fresh one instead of overwriting whatever row already
 * answers to it.
 */
const asReceivedDraft = (entry: Entry): EntryDraft => {
  const draft = { ...entry } as Record<string, unknown>
  for (const key of NOT_THEIRS_TO_SEND) delete draft[key]
  return draft as unknown as EntryDraft
}

/**
 * Receiving: a link in, a preview, and — if it is wanted — a new row of one's
 * own. The hook lives as long as the dialog does, so the preview it holds is
 * gone the moment the dialog closes.
 *
 * What lands in the vault is a copy and nothing more: no back-reference to the
 * sender, no later update. `saveEntry` is the store thunk the editor saves a
 * new entry through, so the row is minted, listed, selected and queued for sync
 * by exactly the path every other new entry takes.
 */
export function useReceive(): Receive {
  const [link, setLink] = useState('')
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // A fetch and an unseal are both slow enough to outlive the dialog that asked
  // for them; whatever they answer after that is nobody's answer.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const open = () => {
    const value = link.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    shareOpen(value)
      .then(opened => {
        if (!alive.current) return
        setEntry(opened)
        setBusy(false)
      })
      // Verbatim: the backend already says which of the three it is ("this is
      // not a Swifty share link", expired, revoked), and only it can tell.
      .catch(reason => {
        if (!alive.current) return
        setError(String(reason))
        setBusy(false)
      })
  }

  const add = () => {
    if (!entry || busy) return
    setBusy(true)
    saveEntry(asReceivedDraft(entry))
      .then(() => alive.current && closeReceive())
      .catch(reason => {
        if (!alive.current) return
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
