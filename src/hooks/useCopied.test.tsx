import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { copyToClipboard } from '@/lib/commands'
import { useCopied } from './useCopied'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCopied', () => {
  it('copies through the clipboard service and flags the confirmation', () => {
    const { result } = renderHook(() => useCopied())
    expect(result.current.copied).toBe(false)

    act(() => result.current.copy('secret'))

    expect(copyToClipboard).toHaveBeenCalledWith('secret', expect.any(Number))
    expect(result.current.copied).toBe(true)
  })

  it('drops the confirmation once the beat elapses', () => {
    const { result } = renderHook(() => useCopied(1200))

    act(() => result.current.copy('secret'))
    act(() => vi.advanceTimersByTime(1199))
    expect(result.current.copied).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.copied).toBe(false)
  })

  it('restarts the beat on a re-copy', () => {
    const { result } = renderHook(() => useCopied(1200))

    act(() => result.current.copy('one'))
    act(() => vi.advanceTimersByTime(1000))
    act(() => result.current.copy('two'))
    act(() => vi.advanceTimersByTime(1000))

    expect(result.current.copied).toBe(true)
  })

  it('clears its timer on unmount', () => {
    const { result, unmount } = renderHook(() => useCopied())

    act(() => result.current.copy('secret'))
    unmount()

    expect(() => vi.runOnlyPendingTimers()).not.toThrow()
  })
})
