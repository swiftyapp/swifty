import { useEffect, useState } from 'react'
import { isMobile } from '@/lib/platform'
import { dialogOpen } from '@/utils/dialogOpen'
import { firstImage } from './fields'
import { runScan } from './run'

/**
 * The whole unlocked window as a drop target for card and document photos.
 *
 * Files arrive as OS paths through the webview rather than as a browser
 * DataTransfer, so this is the same listener the Import drop zone uses (see
 * `Settings/Sections/Import/DropZone`) — one per surface, each minding its own
 * file types. Only images are ours; an export file dropped anywhere still
 * belongs to Import.
 *
 * Returns whether an image is currently being dragged over the window, which is
 * what the overlay renders on.
 */
export function useDropScan(enabled: boolean): boolean {
  const [over, setOver] = useState(false)

  useEffect(() => {
    // Nothing drags a photo onto a phone; there the way in is the picker in
    // `AddSecret/ScanAction`, which opens the Photos library (see `pick.ts`).
    if (!enabled || isMobile) return
    let alive = true
    let unlisten: (() => void) | undefined

    // Imported lazily so a non-Tauri host (the vitest jsdom run) simply never
    // wires the listener up.
    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent(({ payload }) => {
          // A modal owns the window while it is up, and the one with a drop
          // zone in it (Settings › Import) means something else by a drop.
          if (dialogOpen()) return

          if (payload.type === 'enter') {
            setOver(!!firstImage(payload.paths))
            return
          }
          if (payload.type === 'leave') {
            setOver(false)
            return
          }
          if (payload.type === 'drop') {
            setOver(false)
            const image = firstImage(payload.paths)
            if (image) void runScan(image)
          }
          // `over` fires without paths, so what `enter` decided still stands.
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

  return over
}
