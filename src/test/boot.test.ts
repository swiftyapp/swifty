import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { boot } from '@/boot'
import i18n from '@/i18n'
import type { AppStatus } from '@/api/app'
import { useApp, usePrefs } from '@/store'
import { appStatusDefault, calls, mockCommand } from './ipc'
import { deferred } from './utils'

/**
 * What launch has to guarantee: the first frame is themed and in the right
 * language, the window is revealed exactly once, the splash is handed over only
 * after React has committed, and nothing — least of all a dead backend — can
 * leave the app unrendered.
 */

const html = () => document.documentElement

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div><div id="splash"></div>'
  html().className = ''
  html().removeAttribute('data-theme')
})

afterEach(async () => {
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
})
