import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Resolve once the window says it is in front of the user, or once `limitMs`
 * has gone by without it saying so. The answer is whether it did.
 *
 * Polled, because on iOS there is no event to wait for: without a scene
 * manifest tao posts a focus event only on a key-window change, and the
 * scene going active again after a system sheet (Face ID, a notification) is
 * not one. A window whose focus cannot be asked at all counts as in front —
 * there is nothing to wait for.
 */
export async function untilFocused(limitMs: number, everyMs = 100): Promise<boolean> {
  const win = getCurrentWindow()
  const until = Date.now() + limitMs
  for (;;) {
    if (await win.isFocused().catch(() => true)) return true
    if (Date.now() >= until) return false
    await new Promise(resolve => setTimeout(resolve, everyMs))
  }
}
