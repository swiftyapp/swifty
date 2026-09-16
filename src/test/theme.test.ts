import { describe, it, expect, vi } from 'vitest'

// A MediaQueryList stand-in: `matches` flips first, then the change fires, the
// same order the browser uses.
const stubMedia = () => {
  const listeners: (() => void)[] = []
  let dark = false
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark
    },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn)
  }))
  return (next: boolean) => {
    dark = next
    listeners.forEach(fn => fn())
  }
}

const theme = () => document.documentElement.getAttribute('data-theme')

// A fresh load, as main.tsx does it: the store only reacts to changes, so the
// initial preference is painted once at boot.
const boot = async () => {
  vi.resetModules()
  const [{ usePrefs, setPref }, { applyTheme }] = await Promise.all([
    import('@/store/prefs'),
    import('@/theme')
  ])
  applyTheme(usePrefs.getState().theme)
  return setPref
}

describe('theme', () => {
  it('follows the OS while the preference is system', async () => {
    const emit = stubMedia()
    const setPref = await boot()

    setPref('theme', 'system')
    expect(theme()).toBe('light')

    emit(true)
    expect(theme()).toBe('dark')
  })

  it('ignores the OS once an explicit theme is picked', async () => {
    const emit = stubMedia()
    const setPref = await boot()

    setPref('theme', 'light')
    emit(true)

    expect(theme()).toBe('light')
  })
})
