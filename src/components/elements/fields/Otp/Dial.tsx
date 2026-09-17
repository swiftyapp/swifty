import { useTranslation } from 'react-i18next'
import { META } from '../../tokens'

const R = 48
const CIRCUMFERENCE = 2 * Math.PI * R // ≈ 301

// The code, and how long it lives, as one object: a countdown ring around the
// digits. Used to show a saved secret's code and to preview a typed one.
// `period` is the seed's own window, not always 30s, so the ring empties in
// step with the code rather than at a rate of its own.
export default function Dial({
  code,
  time,
  period
}: {
  code: string
  time: number
  period: number
}) {
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
            strokeDasharray={`${(time / period) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        </svg>
        <div className="text-xl tracking-secret tabular-nums text-text">
          {/* Split down the middle: three and three for the usual six, four
              and four for an 8-digit seed, rather than 3 + everything else. */}
          {`${code.slice(0, Math.ceil(code.length / 2))} ${code.slice(Math.ceil(code.length / 2))}`}
        </div>
      </div>
      <div className={META}>
        {t('refreshes in {{n}}s', { n: time })}
      </div>
    </>
  )
}
