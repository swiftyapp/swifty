import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import PrivacyScreen from '.'

type Handler = (event: { payload: boolean }) => void

let handlers: Handler[] = []

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (handler: Handler) => {
      handlers.push(handler)
      return Promise.resolve(() => {
        handlers = handlers.filter(h => h !== handler)
      })
    }
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

const cover = () => screen.queryByTestId('privacy-screen')

describe('PrivacyScreen', () => {
  beforeEach(() => {
    handlers = []
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
})
