import { useCallback, useEffect, useState } from 'react'
import { generateSshKey, type SshKeyPair } from '@/lib/commands'

/**
 * One generated ed25519 keypair and the comment it carries. The comment is
 * encoded inside the key itself, so changing it draws a fresh pair rather than
 * patching the public line.
 *
 * `enabled` keeps the dialog's other modes from spending a keygen they never
 * show.
 */
export function useSshKey(enabled: boolean) {
  const [comment, setComment] = useState('')
  const [pair, setPair] = useState<SshKeyPair | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let current = true
    generateSshKey(comment)
      .then(next => {
        if (current) setPair(next)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [enabled, comment, nonce])

  const regenerate = useCallback(() => setNonce(previous => previous + 1), [])

  return { comment, setComment, pair, regenerate }
}
