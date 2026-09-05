import { useSyncExternalStore, type CSSProperties } from 'react'

export interface VisualViewport {
  /** The height still visible above the on-screen keyboard. */
  height: number
  /** How far iOS has panned the visible area down from the layout viewport's top. */
  offsetTop: number
}

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

// `useSyncExternalStore` re-renders on every snapshot that is not `===` the
// last, so the object is reused until one of its two numbers actually moves.
let last: VisualViewport | null = null
const snapshot = (): VisualViewport | null => {
  const view = viewport()
  if (!view) return (last = null)
  if (last?.height !== view.height || last.offsetTop !== view.offsetTop) {
    last = { height: view.height, offsetTop: view.offsetTop }
  }
  return last
}

/**
 * The part of the page the user can actually see once the keyboard is up.
 *
 * iOS does not shrink the layout viewport when the keyboard comes up: a
 * `height: 100%` shell keeps its full height and pushes the focused input under
 * the keys, and when the caret then has to be scrolled into view iOS pans the
 * visible area down instead, leaving anything anchored to the layout top out
 * of sight. Sizing the compact shell and its sheets from this — height and
 * offset both, see [`viewportStyle`] — keeps the caret in view. Null where the
 * API is absent (desktop webviews, jsdom), and callers then leave it to CSS.
 */
export const useVisualViewport = (): VisualViewport | null =>
  useSyncExternalStore(subscribe, snapshot, () => null)

// The inline style that pins an element to the visible area: its height, and a
// translate for however far iOS has panned it. Both callers (the compact shell,
// the sheet frame) need the same two lines, so they live here.
export const viewportStyle = (view: VisualViewport | null): CSSProperties | undefined =>
  view
    ? {
        height: view.height,
        transform: view.offsetTop ? `translateY(${view.offsetTop}px)` : undefined
      }
    : undefined
