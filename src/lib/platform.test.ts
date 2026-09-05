import { describe, it, expect } from 'vitest'
import { isAndroid, isIOS, isMobile } from './platform'

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
})
