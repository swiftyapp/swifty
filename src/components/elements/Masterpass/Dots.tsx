import { cx } from '@/utils/cx'

// Stagger offsets for the busy ripple, precomputed so renders allocate no
// style objects. 40 covers any plausible passphrase; longer ones wrap.
const WAVE_DELAYS = Array.from({ length: 40 }, (_, i) => ({
  animationDelay: `${i * 70}ms`
}))

interface Props {
  count: number
  caret: boolean
  // The value to show in place of the dots (reveal mode). Same cell grid, so
  // each character appears exactly where its dot was — a true in-place reveal.
  text?: string
  // Verifying: the cells ripple in sequence while the key derives, the
  // immediate "we heard you" feedback for the deliberately slow unlock.
  busy?: boolean
}

// One fixed-width cell per typed character. Cells hold either a mask dot or,
// when `text` is given, the character itself — identical geometry either way,
// centered over the (text-transparent) input, with an optional blinking caret
// trailing them. The pitch (15px) is a hair under the 15px type size so the
// row reads gently tracked-out without going sparse.
export default function Dots({ count, caret, text, busy }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="animate-fade flex w-[15px] flex-none items-center justify-center"
        >
          <span
            className={cx(
              busy && 'animate-[dotwave_1.05s_ease-in-out_infinite]',
              text === undefined
                ? 'h-[7px] w-[7px] rounded-full bg-text/75'
                : 'text-[15px] text-text'
            )}
            style={busy ? WAVE_DELAYS[i % WAVE_DELAYS.length] : undefined}
          >
            {text?.[i]}
          </span>
        </span>
      ))}
      {caret && (
        <span className="ml-1 h-6 w-px bg-accent animate-[caret_1.1s_steps(1,end)_infinite]" />
      )}
    </div>
  )
}
