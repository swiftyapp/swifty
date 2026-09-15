import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_PREFS } from '@/store/prefs'

// The store reads localStorage once, at module load, so each case that seeds
// storage has to load a fresh copy.
const load = async (seed: Record<string, string> = {}) => {
  localStorage.clear()
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)
  vi.resetModules()
  return import('@/store/prefs')
}

describe('prefs', () => {
  it('starts from the defaults when nothing is stored', async () => {
    const { usePrefs } = await load()
    expect(usePrefs.getState()).toEqual(DEFAULT_PREFS)
  })

  it('adopts the legacy per-key values', async () => {
    const { usePrefs } = await load({
      theme: 'dark',
      'rowel:listSort': 'alpha',
      'rowel:breachCheck': 'true',
      'rowel:autolockSecs': '300',
      'rowel:clipboardTimeout': '0',
      'rowel:dateFormat': 'YYYY-MM-DD',
      'rowel:generatorDefaults': '{"symbols":false}'
    })
    const state = usePrefs.getState()
    expect(state.theme).toBe('dark')
    expect(state.sort).toBe('alpha')
    expect(state.breachCheck).toBe(true)
    expect(state.autolockSecs).toBe(300)
    expect(state.clipboardTimeoutMs).toBe(0)
    expect(state.dateFormat).toBe('YYYY-MM-DD')
    expect(state.generator.symbols).toBe(false)
    expect(state.generator.length).toBe(20)
  })

  it('lets the persisted blob win over the legacy keys', async () => {
    const { usePrefs } = await load({
      'rowel:listSort': 'alpha',
      'rowel:prefs': JSON.stringify({ state: { sort: 'recent' }, version: 0 })
    })
    expect(usePrefs.getState().sort).toBe('recent')
  })

  it('degrades a corrupt generator blob to the defaults', async () => {
    const { usePrefs } = await load({ 'rowel:generatorDefaults': '{' })
    expect(usePrefs.getState().generator).toEqual(DEFAULT_PREFS.generator)
  })

  it('replaces a non-numeric generator length', async () => {
    const { usePrefs } = await load({
      'rowel:prefs': JSON.stringify({ state: { generator: { length: 'nope' } }, version: 0 })
    })
    expect(usePrefs.getState().generator.length).toBe(20)
  })

  it('persists what setPref writes', async () => {
    const first = await load()
    first.setPref('sort', 'alpha')

    vi.resetModules()
    const { usePrefs } = await import('@/store/prefs')
    expect(usePrefs.getState().sort).toBe('alpha')
  })

  it('flips the theme both ways', async () => {
    const { usePrefs, toggleTheme } = await load()
    expect(usePrefs.getState().theme).toBe('light')

    toggleTheme()
    expect(usePrefs.getState().theme).toBe('dark')

    toggleTheme()
    expect(usePrefs.getState().theme).toBe('light')
  })
})
