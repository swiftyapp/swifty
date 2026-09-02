import { useState, useEffect } from 'react'
import { generateOtp } from '@/lib/commands'

export const OTP_PERIOD = 30

/**
 * The live TOTP code for a base32 secret: fetched from the backend, ticked down
 * locally, refetched when the window rolls over. An empty or rejected secret
 * yields an empty code, so callers can render the dial unconditionally.
 */
export function useOtp(secret: string): { code: string; time: number } {
  const [code, setCode] = useState('')
  const [time, setTime] = useState(0)

  useEffect(() => {
    setCode('')
    setTime(0)
    if (!secret) return
    let cancelled = false
    generateOtp(secret)
      .then(otp => {
        if (cancelled) return
        setCode(otp.code)
        setTime(otp.time)
      })
      .catch(() => {})
    const id = setInterval(() => setTime(prev => (prev > 0 ? prev - 1 : prev)), 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [secret])

  // The window rolled over while we were watching: ask for the next code.
  useEffect(() => {
    if (!secret || time !== 0 || code === '') return
    generateOtp(secret)
      .then(otp => {
        setCode(otp.code)
        setTime(otp.time)
      })
      .catch(() => {})
  }, [secret, time, code])

  return { code, time }
}
