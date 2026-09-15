import { describe, it, expect, vi, beforeEach } from 'vitest'
import { changeTheme, makeStore, toggleTheme, useStore } from '@/store'

// A MediaQueryList stand-in: `matches` flips first, then the change fires, the
// same order the browser uses. Stubbed before the store module is loaded, since
// the settings slice subscribes to it once, at creation.
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

beforeEach(() => {
  makeStore()
})

describe('theme', () => {
  it('follows the OS while the preference is system', async () => {
    const emit = stubMedia()
    vi.resetModules()
    const { changeTheme: change } = await import('@/store')

    change('system')
    expect(theme()).toBe('light')

    emit(true)
    expect(theme()).toBe('dark')
  })

  it('ignores the OS once an explicit theme is picked', async () => {
    const emit = stubMedia()
    vi.resetModules()
    const { changeTheme: change } = await import('@/store')

    change('light')
    emit(true)

    expect(theme()).toBe('light')
  })

  it('mirrors the preference onto the document', () => {
    changeTheme('dark')
    expect(useStore.getState().settings.theme).toBe('dark')
    expect(theme()).toBe('dark')
  })

  // The palette command is a flip, so "system" resolves before it turns over.
  it('toggles to a concrete preference', () => {
    changeTheme('dark')
    toggleTheme()
    expect(useStore.getState().settings.theme).toBe('light')

    toggleTheme()
    expect(useStore.getState().settings.theme).toBe('dark')
  })
})
