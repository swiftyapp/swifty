import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import PrivacyScreen from '.'

type Handler = (event: { payload: boolean }) => void

let handlers: Handler[] = []
let subscribes = true
let focusedOnMount = true

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (handler: Handler) => {
      if (!subscribes) return Promise.reject(new Error('no window to listen to'))
      handlers.push(handler)
      return Promise.resolve(() => {
        handlers = handlers.filter(h => h !== handler)
      })
    },
    isFocused: () => Promise.resolve(focusedOnMount)
  })
}))

const listening = () => waitFor(() => expect(handlers.length).toBeGreaterThan(0))

const focus = async (on: boolean) => {
  await listening()
  await act(async () => {
    for (const handler of [...handlers]) handler({ payload: on })
  })
}

const visibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const hasFocus = (on: boolean) => vi.spyOn(document, 'hasFocus').mockReturnValue(on)

const domFocus = (on: boolean) =>
  act(() => {
    window.dispatchEvent(new Event(on ? 'focus' : 'blur'))
  })

const cover = () => screen.queryByTestId('privacy-screen')

describe('PrivacyScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // The ordinary case: the vault is in front of the user. jsdom reports the
    // document unfocused, so the mounts that start away from the user say so.
    hasFocus(true)
    handlers = []
    subscribes = true
    focusedOnMount = true
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  it('draws nothing while the user is looking at the window', async () => {
    render(<PrivacyScreen />)
    await listening()
    expect(cover()).not.toBeInTheDocument()
  })

  it('covers the window the moment it resigns active, before the snapshot', async () => {
    render(<PrivacyScreen />)
    await focus(false)
    expect(cover()).toBeInTheDocument()
  })

  it('uncovers when focus comes back', async () => {
    render(<PrivacyScreen />)
    await focus(false)
    await focus(true)
    expect(cover()).not.toBeInTheDocument()
  })

  it('covers a hidden document even without a focus event', async () => {
    render(<PrivacyScreen />)
    await listening()
    visibility('hidden')
    expect(cover()).toBeInTheDocument()
  })

  it('stays covered while the window is visible again but not yet active', async () => {
    render(<PrivacyScreen />)
    await focus(false)
    visibility('hidden')
    visibility('visible')
    expect(cover()).toBeInTheDocument()
  })

  it('releases the focus listener when the vault is no longer on screen', async () => {
    const { unmount } = render(<PrivacyScreen />)
    await listening()
    unmount()
    expect(handlers).toHaveLength(0)
  })

  it('covers from the first frame when the vault unlocks in the background', async () => {
    hasFocus(false)
    focusedOnMount = false

    render(<PrivacyScreen />)
    expect(cover()).toBeInTheDocument()

    await listening()
    expect(cover()).toBeInTheDocument()
  })

  it('covers from the first frame when the document is already hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    })

    render(<PrivacyScreen />)
    expect(cover()).toBeInTheDocument()
  })

  it('covers once the window reports it was never focused', async () => {
    focusedOnMount = false

    render(<PrivacyScreen />)
    expect(cover()).not.toBeInTheDocument()

    await waitFor(() => expect(cover()).toBeInTheDocument())
  })

  it('falls back to DOM focus events when the subscription fails', async () => {
    subscribes = false

    render(<PrivacyScreen />)
    // Let the rejected subscription settle so the DOM listeners are in place.
    await act(async () => {})
    expect(cover()).not.toBeInTheDocument()

    domFocus(false)
    expect(cover()).toBeInTheDocument()

    domFocus(true)
    expect(cover()).not.toBeInTheDocument()
  })
})
