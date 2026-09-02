import { cx } from '@/utils/cx'

// Decorative "key teeth" heights, cycled per character (from the prototype).
const HEIGHTS = [11, 5, 15, 8, 18, 4, 13, 7, 16, 6, 12, 9, 17, 5, 14, 10, 8, 15, 6, 12]
const MAX_CUTS = 40

type Tone = 'idle' | 'bad'

interface Props {
  count: number
  tone?: Tone
}

// A thin rule under the passphrase field with little downward "cut" bars whose
// count follows the passphrase length. Turns bad on error.
export default function KeyCuts({ count, tone = 'idle' }: Props) {
  const line =
    tone === 'bad' ? 'bg-bad' : count > 0 ? 'bg-line2' : 'bg-line'
  const bar = tone === 'bad' ? 'bg-bad' : 'bg-line2'

  const bars = Math.min(count, MAX_CUTS)

  return (
    <div className="relative h-[30px] overflow-hidden">
      <div
        className={cx(
          'absolute inset-x-0 top-0 h-px transition-colors duration-300',
          line
        )}
      />
      <div className="absolute inset-x-0 top-px flex justify-center">
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={cx(
              'mx-[5.5px] w-px rounded-b-sm transition-all duration-300',
              bar
            )}
            style={{ height: HEIGHTS[i % HEIGHTS.length] }}
          />
        ))}
      </div>
    </div>
  )
}
