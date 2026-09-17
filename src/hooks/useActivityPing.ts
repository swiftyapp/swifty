import { useEffect } from 'react'
import { touchActivity } from '@/api/auth'

/**
 * How often, at most, the webview tells Rust the user is still here. The
 * shortest auto-lock is a minute, so a ping every few seconds keeps the idle
 * clock honest without a round trip per keystroke.
 */
export const PING_INTERVAL_MS = 5_000

/** What counts as the user being present. Passive, so scrolling is not delayed. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Feed the inactivity auto-lock (`autolock.rs`). Mounted with the unlocked
 * vault: one ping on mount, so a fresh unlock starts a full timeout rather
 * than inheriting whatever was pending, then one per `PING_INTERVAL_MS` while
 * the user keeps producing input. Idle input stops the pings, and Rust locks
 * the vault `autolockSecs` after the last one.
 */
export function useActivityPing() {
  useEffect(() => {
    let last = 0
    const ping = () => {
      const now = Date.now()
      if (now - last < PING_INTERVAL_MS) return
      last = now
      void touchActivity().catch(() => {})
    }
    ping()
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, ping, { passive: true })
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, ping)
    }
  }, [])
}
