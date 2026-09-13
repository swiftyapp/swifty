import { useCallback, useEffect, useRef } from 'react'

/**
 * Only the newest of overlapping requests gets to touch state.
 *
 * Call the returned function when a request starts; it hands back a check to
 * ask, when the answer arrives, whether that request is still the one that
 * counts — no newer one has started since, and the component is still mounted.
 * An answer that fails the check belongs to nobody: a list read a minute ago
 * must not overwrite one read since, an old failure must not hide a refresh
 * that worked, and a dialog that has moved on must not show a link sealed for
 * the entry it was previously open for.
 */
export function useLatestRequest(): () => () => boolean {
  const newest = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  return useCallback(() => {
    const mine = ++newest.current
    return () => alive.current && mine === newest.current
  }, [])
}
