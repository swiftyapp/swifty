import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStrength } from '@/hooks/useStrength'

describe('useStrength', () => {
  // Guards the perf fix: zxcvbn is heavy and must NOT run during the synchronous
  // render (that blocked the detail panel from painting on selection). A null on
  // the first render proves scoring is deferred; the value lands right after.
  it('defers scoring — null on first render, resolves after paint', async () => {
    const { result } = renderHook(() => useStrength('a-fairly-strong-passphrase-42'))

    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.score).toBeGreaterThanOrEqual(0)
  })

  it('resets to null when the password is cleared', async () => {
    const { result, rerender } = renderHook(({ pw }) => useStrength(pw), {
      initialProps: { pw: 'a-fairly-strong-passphrase-42' }
    })
    await waitFor(() => expect(result.current).not.toBeNull())

    rerender({ pw: '' })
    expect(result.current).toBeNull()
  })
})
