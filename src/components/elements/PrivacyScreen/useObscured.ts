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
 *
 * Every path here fails *closed*. Nothing about mounting means the window is in
 * front of the user: a vault can unlock from biometrics while the user has
 * already swiped to another app, and the component remounts on a workspace
 * switch, which can happen while backgrounded. So the first state comes from
 * what the DOM already knows, and the window is asked for the truth on mount.
 */
export function useObscured(): boolean {
  const [focused, setFocused] = useState(() => document.hasFocus())
  const [hidden, setHidden] = useState(() => document.visibilityState !== 'visible')

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState !== 'visible')
    document.addEventListener('visibilitychange', onVisibility)

    // The subscribe is asynchronous, so an unmount before it lands has to stop
    // the listener that is about to arrive (same shape as `useWebviewDragDrop`).
    let alive = true
    let unlisten: (() => void) | undefined
    // Set once the window itself has spoken; the `isFocused` answer is a
    // reconciliation of the *initial* guess, so a focus event that overtakes it
    // wins — it is the newer fact.
    let reported = false

    const onDomFocus = () => setFocused(true)
    const onDomBlur = () => setFocused(false)
    let domFallback = false

    // If the IPC subscription never lands (no window label, a webview that
    // tears the channel down, an older shell), the cover has to keep working:
    // leaving it up forever locks the user out of their own vault, and dropping
    // it leaves secrets on screen. The DOM's own focus events are the coarser
    // but always-available signal, so switch to them — silently, because the
    // project makes no console calls and there is no user-facing failure here.
    const fallBackToDom = () => {
      if (!alive || domFallback) return
      domFallback = true
      if (!reported) setFocused(document.hasFocus())
      window.addEventListener('focus', onDomFocus)
      window.addEventListener('blur', onDomBlur)
    }

    const win = getCurrentWindow()

    win
      .onFocusChanged(({ payload }) => {
        reported = true
        setFocused(payload)
      })
      .then(stop => {
        if (alive) unlisten = stop
        else stop()
      })
      .catch(fallBackToDom)

    win
      .isFocused()
      .then(isFocused => {
        if (alive && !reported) setFocused(isFocused)
      })
      .catch(() => {
        // Nothing to reconcile with: the DOM guess made at mount stands.
      })

    return () => {
      alive = false
      unlisten?.()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onDomFocus)
      window.removeEventListener('blur', onDomBlur)
    }
  }, [])

  return !focused || hidden
}
