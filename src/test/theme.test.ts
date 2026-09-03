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

describe('theme', () => {
  it('follows the OS while the preference is system', async () => {
    const emit = stubMedia()
    vi.resetModules()
    const { setTheme } = await import('@/theme')

    setTheme('system')
    expect(theme()).toBe('light')

    emit(true)
    expect(theme()).toBe('dark')
  })

  it('ignores the OS once an explicit theme is picked', async () => {
    const emit = stubMedia()
    vi.resetModules()
    const { setTheme } = await import('@/theme')

    setTheme('light')
    emit(true)

    expect(theme()).toBe('light')
  })
})
