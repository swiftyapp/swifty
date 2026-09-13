import { useCallback, useEffect, useRef, useState } from 'react'
import { shareCreate, shareRevoke, type ShareCreated } from '@/lib/commands'
import { useStore, closeSend, queueOrphan, revokeOrphans } from '@/store'
import { useCopied } from '@/hooks/useCopied'

/**
 * Which operation failed, not just what it said. "Try again" has to retry the
 * thing that went wrong: retrying a failed revoke with a create would publish a
 * second link while the first one is still live.
 */
export interface Failure {
  op: 'create' | 'revoke'
  message: string
}

export interface Send {
  /** Without Drive there is nowhere to put the file, so the dialog explains. */
  connected: boolean
  share: ShareCreated | null
  failed: Failure | null
  busy: boolean
  copied: boolean
  copy: () => void
  /** Retries a failed create; the panel only offers it in that state. */
  create: () => void
  /** Revokes, and retries itself after a failed revoke. */
  revoke: () => void
}

/**
 * The whole of sending: seal the entry, hold the link it comes back as, hand it
 * to the clipboard, or take it back. The hook lives as long as the dialog does
 * — closing it unmounts the hook, which is what clears the link.
 *
 * The seal fires on mount rather than behind a button — there is nothing to
 * choose in v1, so a confirm step would only be a press between the user and
 * the one thing this dialog does.
 */
export function useSend(entryId: string): Send {
  const connected = useStore(state => state.sync.enabled)
  const [share, setShare] = useState<ShareCreated | null>(null)
  const [failed, setFailed] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const { copied, copy: copyValue } = useCopied()

  // Each create is tagged, and only the newest tag may reach the screen: a seal
  // is a network round trip, so a slow one can land after the dialog has moved
  // on and put someone else's link under this title.
  const request = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    // A share an earlier dialog could not take back is tried again here, on
    // the way into the next one.
    void revokeOrphans()
    return () => {
      alive.current = false
    }
  }, [])

  const create = useCallback(() => {
    const tag = ++request.current
    setBusy(true)
    setFailed(null)
    shareCreate(entryId)
      .then(created => {
        // Nobody will ever see this link, and the sealed file is already sitting
        // in the sender's Drive with 24 hours to live. Take it back — and if
        // that fails too, remember it, so the next share surface tries again
        // rather than the share quietly outliving everyone who knew about it.
        if (!alive.current || tag !== request.current) {
          queueOrphan(created.fileId)
          void revokeOrphans()
          return
        }
        setShare(created)
        setBusy(false)
      })
      // Backend messages are written to be read ("sync is not configured", "a
      // passkey cannot be shared"), so they are shown as they arrive rather
      // than mapped to copy of our own.
      .catch(reason => {
        if (!alive.current || tag !== request.current) return
        setFailed({ op: 'create', message: String(reason) })
        setBusy(false)
      })
  }, [entryId])

  useEffect(() => {
    if (connected) create()
  }, [connected, create])

  // Through the clipboard service like every other secret: the link is a bearer
  // token for one entry, so it obeys the auto-clear the user configured.
  const copy = () => share && copyValue(share.link)

  const revoke = useCallback(() => {
    if (!share || busy) return
    setBusy(true)
    setFailed(null)
    shareRevoke(share.fileId)
      .then(() => alive.current && closeSend())
      .catch(reason => {
        if (!alive.current) return
        // The link is still live, so it stays on screen with the complaint
        // under it — the only honest thing to show after a failed revoke.
        setFailed({ op: 'revoke', message: String(reason) })
        setBusy(false)
      })
  }, [share, busy])

  return { connected, share, failed, busy, copied, copy, create, revoke }
}
