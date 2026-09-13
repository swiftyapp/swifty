import { useEffect, useState } from 'react'

/**
 * The current time, re-read every `intervalMs` for as long as the caller is
 * mounted. For anything rendered relative to now — "expires in 3 minutes" —
 * which would otherwise stay frozen at whatever the last unrelated render saw.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
