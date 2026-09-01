import { cx } from '@/utils/cx'
import { LEVEL_FILL } from './levels'

// Five-segment level readout, shared by the detail pane's zxcvbn strength bar
// and the generator's entropy bar. `level` is 0–4; `null` renders the empty rail.
export default function Meter({ level }: { level: number | null }) {
  return (
    <span className="flex flex-none gap-[3px]">
      {[0, 1, 2, 3, 4].map(segment => (
        <span
          key={segment}
          className={cx(
            'h-[3px] w-[22px] rounded-full',
            level !== null && segment <= level ? LEVEL_FILL[level] : 'bg-line2'
          )}
        />
      ))}
    </span>
  )
}
