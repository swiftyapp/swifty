import { useCallback, useEffect, useRef, useState } from 'react'
import { shareCreate, shareRevoke, copyToClipboard, type ShareCreated } from '@/lib/commands'
import { useStore, closeSend } from '@/store'

// How long "Copied" stays up, matching every other copy affordance
// (`useCopied`) — the flash is the same flash, only the clipboard call differs.
const FEEDBACK_TIMEOUT = 1200

export interface Send {
  /** Without Drive there is nowhere to put the file, so the dialog explains. */
  connected: boolean
  share: ShareCreated | null
  error: string | null
  busy: boolean
  copied: boolean
  create: () => void
  copy: () => void
  revoke: () => void
}

/**
 * The whole of sending: seal the entry, hold the link it comes back as, hand it
 * to the clipboard, or take it back.
 *
 * The seal fires on open rather than behind a button — there is nothing to
 * choose in v1, so a confirm step would only be a press between the user and
 * the one thing this dialog does.
 */
export function useSend(entryId: string | null): Send {
  const connected = useStore(state => state.sync.enabled)
  const [share, setShare] = useState<ShareCreated | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const create = useCallback(() => {
    if (!entryId) return
    setBusy(true)
    setError(null)
    shareCreate(entryId)
      .then(setShare)
      // Backend messages are written to be read ("sync is not configured"), so
      // they are shown as they arrive rather than mapped to copy of our own.
      .catch(reason => setError(String(reason)))
      .finally(() => setBusy(false))
  }, [entryId])

  // One link per opening, and a different entry is a different opening: the
  // previous entry's link must never be the one on screen under this title.
  useEffect(() => {
    setShare(null)
    setError(null)
    setCopied(false)
    if (connected) create()
  }, [connected, create])

  const copy = () => {
    if (!share) return
    // Deliberately not `services/copy`: that one arms the clipboard auto-clear
    // the user chose for secrets copied out of an entry. A link is copied to be
    // pasted into a messenger, and a value that clears itself two minutes later
    // is a link that silently does not arrive.
    copyToClipboard(share.link)
    clearTimeout(timer.current)
    setCopied(true)
    timer.current = setTimeout(() => setCopied(false), FEEDBACK_TIMEOUT)
  }

  const revoke = () => {
    if (!share) return
    setBusy(true)
    shareRevoke(share.fileId)
      .then(closeSend)
      .catch(reason => {
        setError(String(reason))
        setBusy(false)
      })
  }

  return { connected, share, error, busy, copied, create, copy, revoke }
}
