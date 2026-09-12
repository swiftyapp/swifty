import { cx } from '@/utils/cx'
import { PlusGlyph } from '../Main/icons'

interface Props {
  /** Already translated. */
  label: string
  testid?: string
  onClick: () => void
  /** For a row's `<label>` to point at, when the action stands in for a value. */
  id?: string
  className?: string
}

// The accent-text "+ Add …" an editor ends with: another custom field, a
// one-time code, a variable in a band. Text, not a Button — it appends to the
// thing above it rather than committing anything.
export default function AddAction({ label, testid, onClick, id, className }: Props) {
  return (
    <button
      id={id}
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'flex cursor-pointer items-center gap-1.5 text-base text-accent hover:brightness-110',
        className
      )}
    >
      <PlusGlyph size={13} />
      <span>{label}</span>
    </button>
  )
}
