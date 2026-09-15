import { useEffect, useRef } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { isMobile } from '@/lib/platform'

/**
 * Files dropped onto the window, as OS paths.
 *
 * They arrive through the webview's drag-drop event rather than as a browser
 * DataTransfer, so every drop target in the app wires this same listener and
 * minds its own file types (Import wants an export, the env editor a `.env`).
 * Nothing drags a file onto a phone, so there this is a no-op and the target
 * renders a picker button instead.
 *
 * `onPaths` is read through a ref: the listener is bound once for as long as
 * `enabled` holds, and a caller may hand in a fresh closure every render.
 */
export function useFileDrop(onPaths: (paths: string[]) => void, enabled = true) {
  const handler = useRef(onPaths)
  useEffect(() => {
    handler.current = onPaths
  })

  useEffect(() => {
    if (!enabled || isMobile) return
    let alive = true
    let unlisten: (() => void) | undefined

    getCurrentWebview()
      .onDragDropEvent(event => {
        if (event.payload.type !== 'drop') return
        handler.current(event.payload.paths)
      })
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
