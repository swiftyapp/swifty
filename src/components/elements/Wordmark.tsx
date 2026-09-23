import { APP_NAME } from '@/lib/app'
import { cx } from '@/utils/cx'

interface Props {
  className?: string
}

// The logotype: the app's name set lowercase, bold and tight, in the same
// brand ink as the mascot's body so the two read as one mark. A wordmark is
// lettering rather than UI text, so it takes its own tracking instead of the
// display tier. It sits under the mascot on the lock screen and stays put while
// the mascot moves — the character is alive, the name is the ground it stands on.
export default function Wordmark({ className }: Props) {
  return (
    <span
      aria-label={APP_NAME}
      className={cx(
        'block font-bold text-xl leading-none tracking-[-0.045em] text-brand select-none',
        className
      )}
    >
      {APP_NAME.toLowerCase()}
    </span>
  )
}
