import { useSyncExternalStore } from 'react'

/**
 * Which shell the window is wide enough for.
 *
 * `compact` is the phone shell (one screen at a time, a bottom tab bar);
 * `wide` is the three-pane desktop/iPad shell. 768px is the cut because a
 * landscape phone still belongs on the compact side of it while the smallest
 * iPad in portrait does not.
 */
export type Layout = 'compact' | 'wide'

export const COMPACT_QUERY = '(max-width: 767px)'

// jsdom and a server render have no matchMedia; both fall back to `wide`, which
// is the shell every existing test and the desktop window already assume.
const media = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_QUERY)
    : null

const subscribe = (onChange: () => void) => {
  const query = media()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

const snapshot = (): Layout => (media()?.matches ? 'compact' : 'wide')

export const useLayout = (): Layout => useSyncExternalStore(subscribe, snapshot, () => 'wide')
