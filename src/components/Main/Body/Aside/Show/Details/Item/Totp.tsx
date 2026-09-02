import { useState, useEffect } from 'react'
import { generateOtp, type LoginEntry } from '@/lib/commands'
import { t } from '@/i18n'
import { copy } from '@/services/copy'
import Panel from '@/components/elements/Panel'
import { MONO_LABEL } from '@/components/elements/tokens'

interface Props {
  name: string
  entry: LoginEntry
}

const PERIOD = 30
const R = 48
const CIRCUMFERENCE = 2 * Math.PI * R // ≈ 301

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

  const dash = `${(time / PERIOD) * CIRCUMFERENCE} ${CIRCUMFERENCE}`

  return (
    <Panel className="flex flex-col items-center p-3.5">
      <div className={`self-stretch ${MONO_LABEL}`}>{t(name)}</div>
      <div className="relative m-[10px_0_4px] grid h-[108px] w-[108px] place-items-center">
        <svg
          width="108"
          height="108"
          viewBox="0 0 108 108"
          fill="none"
          className="absolute inset-0 -rotate-90"
        >
          <circle cx="54" cy="54" r={R} stroke="var(--c-line)" strokeWidth="3" />
          <circle
            cx="54"
            cy="54"
            r={R}
            stroke="var(--c-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={dash}
          />
        </svg>
        <div className="font-mono text-xl tracking-secret text-text">
          {`${code.slice(0, 3)} ${code.slice(3)}`}
        </div>
      </div>
      <div className="font-mono text-xs text-text3">
        {t('refreshes in {n}s').replace('{n}', String(time))}
      </div>
      <button
        type="button"
        onClick={() => copy(code)}
        className="mt-3 grid h-7 w-full cursor-pointer place-items-center rounded-sm border border-line2 text-base text-text2 transition-colors hover:border-accent-line hover:text-text"
      >
        {t('Copy code')}
      </button>
    </Panel>
  )
}
