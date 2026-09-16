import { useEffect, useRef } from 'react'
import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview'
import { isMobile } from '@/lib/platform'

/**
 * The webview's drag-drop stream, subscribed to for as long as `enabled` holds.
 *
 * Files arrive as OS paths through this rather than as a browser DataTransfer,
 * so every surface that cares about a drop wires it — and the subscribe is
 * asynchronous, which is the whole reason this is shared: unlistening before
 * the promise lands has to stop the listener that is about to arrive, or a
 * remount leaves one behind. One place that gets it right, rather than one per
 * surface.
 *
 * Nothing drags a file onto a phone, so there this is a no-op and the targets
 * render a picker button instead.
 *
 * `onEvent` is read through a ref: the listener is bound once, and a caller may
 * hand in a fresh closure every render — which the drop targets do, since what
 * a drop means depends on what is on screen.
 */
export function useWebviewDragDrop(onEvent: (payload: DragDropEvent) => void, enabled = true) {
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    if (!enabled || isMobile) return
    let alive = true
    let unlisten: (() => void) | undefined

    getCurrentWebview()
      .onDragDropEvent(({ payload }) => handler.current(payload))
      .then(stop => {
        if (alive) unlisten = stop
        else stop()
      })
      .catch(() => {})

    return () => {
      alive = false
      unlisten?.()
    }
  }, [enabled])
}
