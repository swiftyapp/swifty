import { cx } from '@/utils/cx'

// Decorative "key teeth" heights, cycled per character (from the prototype,
// at half its scale: the cuts mark that something has been typed, they do not
// fill the space between one field and the next).
const HEIGHTS = [6, 3, 8, 4, 9, 2, 7, 4, 8, 3, 6, 5, 9, 3, 7, 5, 4, 8, 3, 6]
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
    <div className="relative h-[14px] overflow-hidden">
      <div
        className={cx(
          'absolute inset-x-0 top-0 h-px transition-colors duration-300',
          line
        )}
      />
      <div className="absolute inset-x-0 top-px flex justify-center">
        {/* 5 + 6 rather than 5.5 each side: the same 12px pitch, but every 1px
            bar starts on a whole pixel instead of straddling two. */}
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={cx(
              'ml-[5px] mr-[6px] w-px rounded-b-sm transition-all duration-300',
              bar
            )}
            style={{ height: HEIGHTS[i % HEIGHTS.length] }}
          />
        ))}
      </div>
    </div>
  )
}
