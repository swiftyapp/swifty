import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { evaluate } from '@/services/strength'
import { useStrength } from '@/hooks/useStrength'

/*
 * The zxcvbn engine arrives in a lazy chunk. A load can fail (offline asset
 * protocol, a half-written update), and when it does the failure must not be
 * the answer for the rest of the session: the next caller has to get another
 * attempt, and the strength meter must swallow the rejection rather than let
 * it surface as an unhandled one.
 */

const engine = vi.hoisted(() => ({ attempts: 0, failNext: false }))

vi.mock('@/services/strengthEngine', () => {
  engine.attempts += 1
  if (engine.failNext) {
    engine.failNext = false
    throw new Error('chunk failed to load')
  }
  return {
    zxcvbn: { check: () => ({ score: 4, feedback: { warning: null, suggestions: [] } }) }
  }
})

const PASSWORD = 'a-fairly-strong-passphrase-42'

describe('strength engine loading', () => {
  it('leaves the meter empty when the load fails, without an unhandled rejection', async () => {
    engine.failNext = true
    const { result } = renderHook(() => useStrength(PASSWORD))

    await waitFor(() => expect(engine.attempts).toBe(1))
    // Give the rejection time to propagate: an unhandled one fails the run.
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(result.current).toBeNull()
  })

  it('tries the load again after a failed one', async () => {
    engine.failNext = true
    const before = engine.attempts

    // vitest wraps a throwing mock factory in its own error, so only the fact
    // of the rejection is asserted here; the recovery is the point.
    await expect(evaluate(PASSWORD)).rejects.toBeInstanceOf(Error)
    await expect(evaluate(PASSWORD)).resolves.toMatchObject({ score: 4, acceptable: true })
    expect(engine.attempts).toBe(before + 2)
  })
})
