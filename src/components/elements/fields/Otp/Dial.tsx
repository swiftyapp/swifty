import { useTranslation } from 'react-i18next'
import { OTP_PERIOD } from '@/hooks/useOtp'
import { MONO_META } from '../../tokens'

const R = 48
const CIRCUMFERENCE = 2 * Math.PI * R // ≈ 301

// The code, and how long it lives, as one object: a countdown ring around the
// six digits. Used to show a saved secret's code and to preview a typed one.
export default function Dial({ code, time }: { code: string; time: number }) {
  const { t } = useTranslation()
  return (
    <>
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
            strokeDasharray={`${(time / OTP_PERIOD) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        </svg>
        <div className="font-mono text-xl tracking-secret text-text">
          {`${code.slice(0, 3)} ${code.slice(3)}`}
        </div>
      </div>
      <div className={MONO_META}>
        {t('refreshes in {{n}}s', { n: time })}
      </div>
    </>
  )
}
