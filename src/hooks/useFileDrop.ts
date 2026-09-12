import { useEffect, useRef } from 'react'
import { isMobile } from '@/lib/platform'

/**
 * Files dropped onto the window, as OS paths.
 *
 * They arrive through the webview's drag-drop event rather than as a browser
 * DataTransfer, so every drop target in the app wires this same listener and
 * minds its own file types (Import wants an export, the env editor a `.env`).
 * The API is imported lazily so a non-Tauri host (the vitest jsdom run) simply
 * never wires the listener up. Nothing drags a file onto a phone, so there this
 * is a no-op and the target renders a picker button instead.
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

    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent(event => {
          if (event.payload.type !== 'drop') return
          handler.current(event.payload.paths)
        })
      )
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
