import { useState, useEffect } from 'react'
import { generateOtp } from '@/api/tools'

// The window every seed has unless its own parameters say otherwise: what the
// ring is scaled to until the first code comes back with the real one.
const DEFAULT_PERIOD = 30

/**
 * The live TOTP code for a stored secret — a bare base32 seed or an otpauth://
 * URI, whichever the entry holds: fetched from the backend, ticked down
 * locally, refetched when the window rolls over. An empty or rejected secret
 * yields an empty code, so callers can render the dial unconditionally.
 */
export function useOtp(secret: string): { code: string; time: number; period: number } {
  const [code, setCode] = useState('')
  const [time, setTime] = useState(0)
  const [period, setPeriod] = useState(DEFAULT_PERIOD)

  useEffect(() => {
    setCode('')
    setTime(0)
    setPeriod(DEFAULT_PERIOD)
    if (!secret) return
    let cancelled = false
    generateOtp(secret)
      .then(otp => {
        if (cancelled) return
        setCode(otp.code)
        setTime(otp.time)
        setPeriod(otp.period || DEFAULT_PERIOD)
      })
      .catch(() => {})
    const id = setInterval(() => setTime(prev => (prev > 0 ? prev - 1 : prev)), 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [secret])

  // The window rolled over while we were watching: ask for the next code. Same
  // guard as the first fetch — without it a rollover left in flight when the
  // field switches secrets lands on top of the new secret's code.
  useEffect(() => {
    if (!secret || time !== 0 || code === '') return
    let cancelled = false
    generateOtp(secret)
      .then(otp => {
        if (cancelled) return
        setCode(otp.code)
        setTime(otp.time)
        setPeriod(otp.period || DEFAULT_PERIOD)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [secret, time, code])

  return { code, time, period }
}
