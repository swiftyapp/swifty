import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import ReactDOM, { type Root } from 'react-dom/client'
import { boot } from '@/boot'
import i18n from '@/i18n'
import type { AppStatus, Settings } from '@/api/app'
import { DEFAULT_PREFS, useApp, usePrefs } from '@/store'
import { appStatusDefault, calls, mockCommand } from './ipc'
import { deferred } from './utils'

/**
 * What launch has to guarantee: the first frame is themed and in the right
 * language, the window is revealed exactly once, the splash is handed over only
 * after the flow on screen has committed, and nothing — least of all a dead
 * backend — can leave the app unrendered.
 */

// The setup flow's chunk, held back until a test lets it through, so the one
// launch that opens on it can be observed with the chunk still on its way.
const startChunk = vi.hoisted(() => {
  let release = () => {}
  const arrived = new Promise<void>(resolve => {
    release = resolve
  })
  return { arrived, release }
})
vi.mock('@/components/Start', async () => {
  await startChunk.arrived
  return vi.importActual('@/components/Start')
})

const html = () => document.documentElement

// `boot()` owns its root and never hands it out, so each is caught on the way
// through and unmounted after its test: a root left behind would keep rendering
// on every store change, and its flow root committing would hand the splash off
// on the next test's behalf.
const roots: Root[] = []
const createRoot = ReactDOM.createRoot
vi.spyOn(ReactDOM, 'createRoot').mockImplementation((...args) => {
  const root = createRoot(...args)
  roots.push(root)
  return root
})

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div><div id="splash"></div>'
  html().className = ''
  html().removeAttribute('data-theme')
  localStorage.clear()
})

afterEach(async () => {
  act(() => roots.splice(0).forEach(root => root.unmount()))
  delete window.__ROWEL_BOOT__
  // Every other suite runs against the catalogue setup.ts started.
  await act(async () => {
    await i18n.changeLanguage('en-US')
  })
})

describe('boot', () => {
  it('paints in the injected theme and language before any IPC answers', async () => {
    const probe = deferred<AppStatus>()
    mockCommand('app_status', () => probe.promise)
    window.__ROWEL_BOOT__ = {
      locale: 'de-DE',
      settings: { ...appStatusDefault().settings, theme: 'dark' }
    }

    const booted = boot()

    // Synchronously, before anything has been awaited: the stored theme is on
    // the document, and the splash is already running.
    expect(html()).toHaveAttribute('data-theme', 'dark')
    expect(usePrefs.getState().theme).toBe('dark')
    expect(html()).toHaveClass('splash-live')

    // The catalogue is loaded for the injected language with the probe still
    // out, so the language never waited on a round trip.
    await act(() => vi.waitFor(() => expect(i18n.language).toBe('de-DE')))

    probe.resolve({ ...appStatusDefault(), locale: 'de-DE' })
    await act(() => booted)
    expect(i18n.language).toBe('de-DE')
  })

  it('opens in the probe’s locale when nothing was injected', async () => {
    mockCommand('app_status', () => ({ ...appStatusDefault(), locale: 'fr-FR' }))

    await act(() => boot())

    expect(i18n.language).toBe('fr-FR')
    expect(useApp.getState().status?.locale).toBe('fr-FR')
  })

  it('renders anyway when the probe fails, leaving the shell to re-ask', async () => {
    useApp.setState({ status: null })
    mockCommand('app_status', () => Promise.reject({ kind: 'other', message: 'no backend' }))

    await act(() => boot())

    expect(document.getElementById('root')?.innerHTML).not.toBe('')
    expect(useApp.getState().status).toBeNull()
  })

  it('reveals the window once, whatever else happens', async () => {
    mockCommand('app_status', () => Promise.reject({ kind: 'other', message: 'no backend' }))

    await act(() => boot())

    expect(calls('app_ready')).toHaveLength(1)
  })

  it('hands the splash over only once React has committed', async () => {
    const probe = deferred<AppStatus>()
    mockCommand('app_status', () => probe.promise)

    const booted = boot()
    expect(html()).not.toHaveClass('splash-done')

    probe.resolve(appStatusDefault())
    await act(() => booted)

    expect(html()).toHaveClass('splash-done')

    // And the overlay leaves the tree once it has finished fading.
    document.getElementById('splash')!.dispatchEvent(new Event('transitionend'))
    expect(document.getElementById('splash')).toBeNull()
  })

  it('carries localStorage preferences over after the first commit, not before', async () => {
    localStorage.setItem('rowel:listSort', 'alpha')
    // What was on screen when the import's write landed: it must find React
    // already committed, since it is off the boot path by design. (The prefs
    // store also records the language i18next settles on; only the carried
    // preference is the import's.)
    let renderedAtImport: boolean | null = null
    mockCommand('set_settings', ({ patch }) => {
      const next = patch as Partial<Settings>
      if (next.sort) renderedAtImport = document.getElementById('root')?.innerHTML !== ''
      return { ...DEFAULT_PREFS, ...next }
    })

    await act(() => boot())

    const imported = () => calls('set_settings').map(call => call.patch)
    await waitFor(() => expect(imported()).toContainEqual({ sort: 'alpha' }))
    expect(renderedAtImport).toBe(true)
    // Once, and the key is gone so the next launch has nothing to import.
    expect(localStorage.getItem('rowel:listSort')).toBeNull()
  })

  // Last: it lets the setup chunk through, and nothing holds it back again.
  it('keeps the splash up over a fresh install until the setup flow has loaded', async () => {
    mockCommand('app_status', () => ({ ...appStatusDefault(), initialized: false }))

    await act(() => boot())

    // Routed before the first render, so the flow that commits first is the
    // one the user will see — and with its chunk still out, nothing has
    // committed, so the splash is still covering the window.
    expect(useApp.getState().flow).toBe('setup')
    expect(html()).not.toHaveClass('splash-done')

    startChunk.release()
    // The first import of the setup tree is dozens of modules, and vitest
    // transforms them on the way in — slower than any real chunk load. Not
    // under `act`: that would hold React's retry of the boundary until the
    // wait itself gave up.
    await waitFor(() => expect(html()).toHaveClass('splash-done'), { timeout: 10_000 })
    expect(document.getElementById('root')?.innerHTML).not.toBe('')
  })
})
