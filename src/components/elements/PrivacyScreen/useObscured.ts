import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Whether the window is on screen but no longer in front of the user.
 *
 * Two independent sources, OR'd, because neither sees everything:
 *
 * - `onFocusChanged` is the one that fires *early*. On iOS Tauri forwards
 *   `sceneWillResignActive` as `Focused(false)`, which is the notification that
 *   arrives before the system snapshots the webview for the app switcher — the
 *   only moment at which anything the frontend does can still affect what ends
 *   up in that snapshot. On the desktop it is the alt-tab / Mission Control
 *   case.
 * - `visibilitychange` is the belt to that's braces: a webview that is
 *   backgrounded without the focus event landing (a resumed process, a
 *   platform that reports one and not the other) still reports itself hidden.
 *
 * Kept as two flags rather than one because they clear at different times: on
 * the way back in, iOS makes the webview visible again before
 * `sceneDidBecomeActive` says the scene is active, so folding them into a
 * single boolean would lift the cover a beat early — while the app is still
 * scrubbing past in the switcher.
 */
export function useObscured(): boolean {
  // Focused to start with: nothing mounts this but a vault that has just been
  // unlocked, in a window the user is typing into.
  const [focused, setFocused] = useState(true)
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)

    // The subscribe is asynchronous, so an unmount before it lands has to stop
    // the listener that is about to arrive (same shape as `useWebviewDragDrop`).
    let alive = true
    let unlisten: (() => void) | undefined
    getCurrentWindow()
      .onFocusChanged(({ payload }) => setFocused(payload))
      .then(stop => {
        if (alive) unlisten = stop
        else stop()
      })
      .catch(() => {})

    return () => {
      alive = false
      unlisten?.()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return !focused || hidden
}
