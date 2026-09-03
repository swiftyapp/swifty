import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { generateOtp } from '@/lib/commands'
import { useOtp } from './useOtp'

type Otp = { code: string; time: number }

/** A promise the test resolves by hand, to hold one fetch in flight. */
const deferred = () => {
  let resolve: (otp: Otp) => void = () => {}
  const promise = new Promise<Otp>(r => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => vi.clearAllMocks())

describe('useOtp', () => {
  // The rollover refetch outlives the secret it was asked for: a slow answer
  // for the old secret must not overwrite the new secret's code.
  it('discards a rollover fetch for a secret that is no longer current', async () => {
    const stale = deferred()
    let asked = 0
    vi.mocked(generateOtp).mockImplementation(secret => {
      if (secret !== 'AAAAAAAA') return Promise.resolve({ code: '222222', time: 30 })
      // The first code for AAAAAAAA arrives with its window already spent, so
      // the rollover fetch fires straight away — and then hangs.
      asked += 1
      return asked === 1 ? Promise.resolve({ code: '111111', time: 0 }) : stale.promise
    })

    const { result, rerender } = renderHook(({ secret }) => useOtp(secret), {
      initialProps: { secret: 'AAAAAAAA' }
    })

    await waitFor(() => expect(result.current.code).toBe('111111'))
    await waitFor(() => expect(asked).toBe(2))

    rerender({ secret: 'BBBBBBBB' })
    await waitFor(() => expect(result.current.code).toBe('222222'))

    await act(async () => {
      stale.resolve({ code: '999999', time: 27 })
    })

    expect(result.current.code).toBe('222222')
    expect(result.current.time).toBe(30)
  })
})
