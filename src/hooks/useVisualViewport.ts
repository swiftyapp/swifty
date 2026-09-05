import { useSyncExternalStore } from 'react'

const viewport = () => (typeof window === 'undefined' ? null : (window.visualViewport ?? null))

const subscribe = (onChange: () => void) => {
  const view = viewport()
  view?.addEventListener('resize', onChange)
  view?.addEventListener('scroll', onChange)
  return () => {
    view?.removeEventListener('resize', onChange)
    view?.removeEventListener('scroll', onChange)
  }
}

const snapshot = () => viewport()?.height ?? null

/**
 * The height still visible above the on-screen keyboard.
 *
 * iOS does not shrink the layout viewport when the keyboard comes up, so a
 * `height: 100%` shell keeps its full height and pushes the focused input under
 * the keys. Sizing the compact shell and its sheets from this instead keeps the
 * caret in view. Null where the API is absent (desktop webviews, jsdom), and
 * callers then leave the height to CSS.
 */
export const useVisualViewport = (): number | null =>
  useSyncExternalStore(subscribe, snapshot, () => null)
