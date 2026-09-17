import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { calls, resetIpc } from '@/test/ipc'
import { PING_INTERVAL_MS, useActivityPing } from './useActivityPing'

describe('useActivityPing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetIpc()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pings once on mount, so a fresh unlock starts a full timeout', () => {
    renderHook(() => useActivityPing())
    expect(calls('touch_activity')).toHaveLength(1)
  })

  it('collapses a burst of input into one ping per interval', () => {
    renderHook(() => useActivityPing())
    act(() => {
      window.dispatchEvent(new Event('keydown'))
      window.dispatchEvent(new Event('pointermove'))
      window.dispatchEvent(new Event('wheel'))
    })
    expect(calls('touch_activity')).toHaveLength(1)

    vi.advanceTimersByTime(PING_INTERVAL_MS)
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(calls('touch_activity')).toHaveLength(2)
  })

  it('stops listening when the vault is no longer on screen', () => {
    const { unmount } = renderHook(() => useActivityPing())
    unmount()
    vi.advanceTimersByTime(PING_INTERVAL_MS)
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(calls('touch_activity')).toHaveLength(1)
  })
})
