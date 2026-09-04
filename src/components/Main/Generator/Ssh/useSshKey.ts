import { useCallback, useEffect, useState } from 'react'
import { generateSshKey, type SshKeyPair } from '@/lib/commands'

/**
 * One generated ed25519 keypair and the comment it carries. The comment is
 * encoded inside the key itself, so changing it draws a fresh pair rather than
 * patching the public line.
 *
 * `enabled` keeps the dialog's other modes from spending a keygen they never
 * show.
 *
 * `pending` is true from the moment a draw is asked for until it lands: the
 * previous pair stays on screen meanwhile, so the caller must not accept it —
 * it is the key the user just asked to replace. `error` is set when Rust
 * refused; the pair is cleared then, so nothing stale can be saved either.
 */
export function useSshKey(enabled: boolean) {
  const [comment, setComment] = useState('')
  const [pair, setPair] = useState<SshKeyPair | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let current = true
    setPending(true)
    setError(false)
    generateSshKey(comment)
      .then(next => {
        if (!current) return
        setPair(next)
        setPending(false)
      })
      .catch(() => {
        if (!current) return
        setPair(null)
        setError(true)
        setPending(false)
      })
    return () => {
      current = false
    }
  }, [enabled, comment, nonce])

  const regenerate = useCallback(() => setNonce(previous => previous + 1), [])

  // Only a settled, successful draw may be handed on.
  const ready = pair !== null && !pending && !error

  return { comment, setComment, pair, pending, error, ready, regenerate }
}
