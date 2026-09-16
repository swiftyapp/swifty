import { useState } from 'react'
import { isModalOpen } from '@/store'
import { useWebviewDragDrop } from '@/hooks/useWebviewDragDrop'
import { firstImage } from './fields'
import { runScan } from './run'

/**
 * The whole unlocked window as a drop target for card and document photos.
 *
 * The same webview stream the Import drop zone listens on (see
 * `Settings/Sections/Import/DropZone`) — one subscription per surface, each
 * minding its own file types. Only images are ours; an export file dropped
 * anywhere still belongs to Import.
 *
 * Returns whether an image is currently being dragged over the window, which is
 * what the overlay renders on.
 */
export function useDropScan(enabled: boolean): boolean {
  const [over, setOver] = useState(false)

  useWebviewDragDrop(payload => {
    // A modal owns the window while it is up, and the one with a drop zone in
    // it (Settings › Import) means something else by a drop.
    if (isModalOpen()) return

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
  }, enabled)

  return over
}
