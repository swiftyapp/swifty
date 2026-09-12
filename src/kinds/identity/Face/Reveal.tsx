import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'

interface Props {
  shown: boolean
  onToggle: () => void
  className?: string
}

// The one eye on a face: it lifts every mask at once, as the credit card's does.
// `reveal-number` is the selector the e2e suite presses, and its label is what
// it reads to know which way the toggle is.
export default function Reveal({ shown, onToggle, className }: Props) {
  const { t } = useTranslation()
  const label = shown ? t('Hide') : t('Reveal')

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      data-testid="reveal-number"
      className={cx(
        'grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-sm text-(--face-ink2) transition-colors hover:bg-(--face-hover) hover:text-(--face-ink)',
        className
      )}
    >
      {shown ? <EyeOffGlyph /> : <EyeGlyph />}
    </button>
  )
}
