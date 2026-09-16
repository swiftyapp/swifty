import { describe, it, expect } from 'vitest'
import { chord, isAndroid, isIOS, isMobile, isPC } from './platform'

// The `define` in vite.config.ts is what makes `__TAURI_PLATFORM__` exist at
// all: drop it and importing this module throws a ReferenceError rather than
// quietly reading as desktop. A plain vitest run sets no TAURI_ENV_PLATFORM,
// so this is both the define's default and the desktop mapping.
describe('platform', () => {
  it('reads as desktop when the Tauri CLI set no platform', () => {
    expect(__TAURI_PLATFORM__).toBe('')
    expect(isIOS).toBe(false)
    expect(isAndroid).toBe(false)
    expect(isMobile).toBe(false)
  })

  // Not a PC either, so the hint chips read the Apple way — the same default a
  // macOS build gets.
  it('spells shortcut hints with ⌘', () => {
    expect(isPC).toBe(false)
    expect(chord('F')).toBe('⌘F')
  })
})
