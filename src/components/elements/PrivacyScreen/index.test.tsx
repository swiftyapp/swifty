import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import PrivacyScreen from '.'
import { RECHECK_MS } from './useObscured'

type Handler = (event: { payload: boolean }) => void

let handlers: Handler[] = []
let subscribes = true
let focusedOnMount = true
// How many times the window has been asked `isFocused`: the mount-time
// reconciliation and every re-check while covered.
let asked = 0
// Holds the one-shot `isFocused` answer open, so a test can choose whether it
// lands before or after the subscription settles.
let pendingFocused: Promise<boolean> | undefined
let answerFocused: ((on: boolean) => void) | undefined

const deferFocused = () => {
  pendingFocused = new Promise<boolean>(resolve => {
    answerFocused = resolve
  })
}

const sayFocused = async (on: boolean) => {
  await act(async () => {
    answerFocused?.(on)
  })
}

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (handler: Handler) => {
      if (!subscribes) return Promise.reject(new Error('no window to listen to'))
      handlers.push(handler)
      return Promise.resolve(() => {
        handlers = handlers.filter(h => h !== handler)
      })
    },
    isFocused: () => {
      asked++
      return pendingFocused ?? Promise.resolve(focusedOnMount)
    }
  })
}))

// One re-check under fake timers: the interval fires, the window's answer lands.
const tick = () =>
  act(async () => {
    vi.advanceTimersByTime(RECHECK_MS)
  })

const listening = () => waitFor(() => expect(handlers.length).toBeGreaterThan(0))

// A focus event from the window, to listeners already in place.
const report = (on: boolean) =>
  act(async () => {
    for (const handler of [...handlers]) handler({ payload: on })
  })

const focus = async (on: boolean) => {
  await listening()
  await report(on)
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

// A failing subscription rejects through `.then().catch()`, so the fallback is
// a couple of microtask ticks behind the render rather than one.
const settle = async () => {
  for (let tick = 0; tick < 3; tick++) await act(async () => {})
}

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
    asked = 0
    pendingFocused = undefined
    answerFocused = undefined
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('keeps the cover when the subscription fails after the window said it was not focused', async () => {
    subscribes = false
    focusedOnMount = false
    // The DOM still claims focus — the guess the fallback would otherwise make,
    // and the one that would strip the cover back off.
    hasFocus(true)

    render(<PrivacyScreen />)
    await settle()

    expect(cover()).toBeInTheDocument()
  })

  it('covers when the window says it is not focused after the fallback is already in place', async () => {
    subscribes = false
    hasFocus(true)
    deferFocused()

    render(<PrivacyScreen />)
    await settle()
    expect(cover()).not.toBeInTheDocument()

    await sayFocused(false)
    expect(cover()).toBeInTheDocument()
  })

  it('lets a focus event outrank the window reconciliation that lands after it', async () => {
    deferFocused()

    render(<PrivacyScreen />)
    await focus(false)
    expect(cover()).toBeInTheDocument()

    await sayFocused(true)
    expect(cover()).toBeInTheDocument()
  })

  // The Face ID unlock on iOS: the vault mounts while the system sheet still
  // has the scene inactive, the window says "not focused", and no focus event
  // ever follows. The cover has to find its own way back down.
  // Fake timers from before the mount, so the re-check interval is scheduled on
  // them; the subscription and reconciliation are promises, so `settle` is
  // enough to land them without `waitFor`.
  it('lifts the cover once the window, asked again, says it is focused', async () => {
    vi.useFakeTimers()
    focusedOnMount = false

    render(<PrivacyScreen />)
    await settle()
    expect(cover()).toBeInTheDocument()

    focusedOnMount = true
    await tick()
    expect(cover()).not.toBeInTheDocument()

    // Uncovered, there is nothing left to ask about.
    const settled = asked
    await tick()
    expect(asked).toBe(settled)
  })

  it('keeps the cover while the window keeps saying it is not focused', async () => {
    vi.useFakeTimers()
    focusedOnMount = false

    render(<PrivacyScreen />)
    await settle()
    expect(cover()).toBeInTheDocument()
    const before = asked

    await tick()
    expect(asked).toBe(before + 1)
    expect(cover()).toBeInTheDocument()
  })

  it('ignores a re-check answer from before a blur event', async () => {
    vi.useFakeTimers()

    render(<PrivacyScreen />)
    await settle()
    await report(false)
    expect(cover()).toBeInTheDocument()

    // Hold the next re-check open once it has been sent.
    const before = asked
    deferFocused()
    await tick()
    expect(asked).toBe(before + 1)

    // A second tick asks nothing while that one is still out.
    await tick()
    expect(asked).toBe(before + 1)

    // The window blurs again while the answer is still on its way...
    await report(false)
    // ...so a "focused" from before the blur is stale, and must not lift the cover.
    await sayFocused(true)
    expect(cover()).toBeInTheDocument()

    // The next re-check asks afresh, and that answer counts.
    pendingFocused = undefined
    focusedOnMount = true
    await tick()
    expect(cover()).not.toBeInTheDocument()
  })

  it('lets a DOM focus event outrank the window reconciliation that lands after it', async () => {
    subscribes = false
    hasFocus(true)
    deferFocused()

    render(<PrivacyScreen />)
    await settle()

    domFocus(false)
    expect(cover()).toBeInTheDocument()

    await sayFocused(true)
    expect(cover()).toBeInTheDocument()
  })
})
