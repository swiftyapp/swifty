import { useRef, type Ref, type RefObject } from 'react'

/**
 * One node, two refs.
 *
 * A component that has to hold on to its own DOM node — every dialog frame
 * does, for the focus trap — cannot also just pass the caller's `ref` down.
 * This returns the local object to keep and the callback ref to attach, which
 * fills both.
 */
export function useForwardedRef<T>(
  forwarded: Ref<T> | undefined
): [RefObject<T | null>, (node: T | null) => void] {
  const local = useRef<T>(null)

  const attach = (node: T | null) => {
    local.current = node
    if (typeof forwarded === 'function') forwarded(node)
    // Filling a caller's ref object IS ref forwarding — it is what React itself
    // does for a `ref` prop, and it runs from a callback ref (after commit),
    // not during render. `react-hooks/immutability` only sees a hook argument
    // being written to.
    // eslint-disable-next-line react-hooks/immutability
    else if (forwarded) forwarded.current = node
  }

  return [local, attach]
}
