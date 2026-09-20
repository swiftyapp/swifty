import { useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * How often, while the cover is up on the window's own word, the window is
 * asked again. Only runs while covered, so the cost is a few IPC round trips
 * during an absence; short enough that the vault appears without a visible wait
 * once the window says it is back.
 */
export const RECHECK_MS = 300

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
 *
 * And failing closed cannot mean staying closed. On iOS the app runs the
 * legacy UIKit lifecycle (no scene manifest in Info.plist), where tao posts a
 * focus event only on a key-window change — once, at launch — and turns
 * resign/become-active into nothing the webview hears. The Face ID sheet
 * leaves the scene inactive while it comes down, the vault mounts behind it
 * and asks, the window says "not focused", and no event ever says otherwise.
 * So while the cover is up on the window's word, the window is asked again
 * until it says the user is back.
 */
export function useObscured(): boolean {
  const [focused, setFocused] = useState(() => document.hasFocus())
  const [hidden, setHidden] = useState(() => document.visibilityState !== 'visible')
  // Counts every answer about focus, so a re-check that was in flight when an
  // event landed can tell it is stale and not lift a cover that event raised.
  const spoke = useRef(0)

  // While covered because the window said so, ask it again. Only ever lifts:
  // events and the reconciliation are what put the cover up, and each of them
  // is a newer fact than a re-check that started before it.
  useEffect(() => {
    if (focused) return
    let alive = true
    const win = getCurrentWindow()
    const recheck = () => {
      const at = spoke.current
      win
        .isFocused()
        .then(on => {
          if (alive && on && spoke.current === at) setFocused(true)
        })
        .catch(() => {
          // No answer is no news: the next tick asks again.
        })
    }
    const id = window.setInterval(recheck, RECHECK_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [focused])

  useEffect(() => {
    const say = (on: boolean) => {
      spoke.current++
      setFocused(on)
    }
    const onVisibility = () => setHidden(document.visibilityState !== 'visible')
    document.addEventListener('visibilitychange', onVisibility)

    // The subscribe is asynchronous, so an unmount before it lands has to stop
    // the listener that is about to arrive (same shape as `useWebviewDragDrop`).
    let alive = true
    let unlisten: (() => void) | undefined
    // Two separate facts, because they answer different questions. `reported`
    // is "an event told us", `reconciled` is "the one-shot `isFocused` answered
    // the initial guess". An event is always the newer fact, so it overrides a
    // reconciliation that lands after it; but a reconciliation that has already
    // spoken is still far better than re-guessing from the DOM, which is what
    // the fallback would otherwise do.
    let reported = false
    let reconciled = false

    const onDomFocus = () => {
      reported = true
      say(true)
    }
    const onDomBlur = () => {
      reported = true
      say(false)
    }
    let domFallback = false

    // If the IPC subscription never lands (no window label, a webview that
    // tears the channel down, an older shell), the cover has to keep working:
    // leaving it up forever locks the user out of their own vault, and dropping
    // it leaves secrets on screen. The DOM's own focus events are the coarser
    // but always-available signal, so switch to them — silently, because the
    // project makes no console calls and there is no user-facing failure here.
    //
    // Seeding from `document.hasFocus()` is only a guess, and jsdom aside, a
    // webview that has resigned active can still report the document focused.
    // So it is used *only* when nothing better has spoken: if an event or the
    // `isFocused` reconciliation already answered, that answer stands and this
    // just attaches the listeners.
    const fallBackToDom = () => {
      if (!alive || domFallback) return
      domFallback = true
      if (!reported && !reconciled) say(document.hasFocus())
      window.addEventListener('focus', onDomFocus)
      window.addEventListener('blur', onDomBlur)
    }

    const win = getCurrentWindow()

    win
      .onFocusChanged(({ payload }) => {
        reported = true
        say(payload)
      })
      .then(stop => {
        if (alive) unlisten = stop
        else stop()
      })
      .catch(fallBackToDom)

    win
      .isFocused()
      .then(isFocused => {
        if (!alive || reported) return
        // Also applies when the fallback already ran and seeded from the DOM:
        // this is the window's own answer, so it replaces that guess.
        reconciled = true
        say(isFocused)
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
