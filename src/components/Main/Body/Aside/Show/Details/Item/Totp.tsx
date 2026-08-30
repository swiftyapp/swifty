import { useState, useEffect } from 'react'
import { generateOtp, type LoginEntry } from '@/lib/commands'
import { t } from '@/i18n'
import { copy } from '@/services/copy'
import Copy from '@/assets/images/copy.svg?react'

interface Props {
  name: string
  entry: LoginEntry
}

export default function Totp({ name, entry }: Props) {
  const [time, setTime] = useState(0)
  const [code, setCode] = useState('')
  const secret = entry.otp

  useEffect(() => {
    if (!secret) return
    let cancelled = false
    const load = () =>
      generateOtp(secret)
        .then(otp => {
          if (cancelled) return
          setTime(otp.time)
          setCode(otp.code)
        })
        .catch(() => {})
    load()
    const id = setInterval(() => setTime(prev => (prev > 0 ? prev - 1 : prev)), 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [secret])

  useEffect(() => {
    if (secret && time === 0 && code !== '') {
      generateOtp(secret)
        .then(otp => {
          setTime(otp.time)
          setCode(otp.code)
        })
        .catch(() => {})
    }
  }, [secret, time, code])

  if (!secret) return null

  return (
    <div className="item">
      <div className="label">{t(name)}</div>
      <div className="value">
        <strong className="muted">{`${code.slice(0, 3)} ${code.slice(3)}`}</strong>
      </div>
      <div className="secondary">{time}</div>
      <Copy width="16" height="16" onClick={() => copy(code)} />
    </div>
  )
}
