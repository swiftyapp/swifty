import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { cx } from '@/utils/cx'
import { useCopied } from '@/hooks/useCopied'
import { CheckGlyph, CopyGlyph } from '@/components/Main/icons'

// A face is a miniature, so its captions sit one step under the detail rows'
// 11px label tier and are tracked a little tighter: "NATIONALITY" and
// "PERSONAL NO." have to fit a third of the holder's column.
export const CAPTION = 'text-2xs uppercase tracking-[0.1em]'

interface Props {
  /** The draft key — `entry-value-<name>` is the selector the e2e suite owns. */
  name: string
  /** Untranslated caption over the value. The name and the header code go bare. */
  label?: TKey
  /** What is stored, and what a click copies. */
  value: string
  /** What is shown, when that differs: a date in the user's pattern, a mask. */
  display?: string
  /** The value line's type. The name and the number are the big ones. */
  ink?: string
  /** Wrap rather than truncate: a document number is never worth clipping. */
  wrap?: boolean
  className?: string
}

// One printed value on a document face: a micro-label, the value, and a copy on
// click — the same gesture the credit card face teaches, in the face's own ink.
export default function Cell({
  name,
  label,
  value,
  display = value,
  ink = 'text-base',
  wrap,
  className
}: Props) {
  const { t } = useTranslation()
  const { copied, copy } = useCopied()

  return (
    <button
      type="button"
      onClick={() => copy(value)}
      title={t('Copy')}
      aria-label={label ? `${t(label)} · ${t('Copy')}` : t('Copy')}
      className={cx(
        'group relative -mx-1.5 min-w-0 cursor-pointer rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-(--face-hover)',
        className
      )}
    >
      {label && (
        <span className={`block truncate ${CAPTION} text-(--face-ink2)`}>{t(label)}</span>
      )}
      <span
        className={cx('block min-w-0 leading-6', wrap ? 'break-all' : 'truncate', label && 'mt-0.5', ink)}
        data-testid={`entry-value-${name}`}
      >
        {display}
      </span>
      <span className="pointer-events-none absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-50">
        <CopyGlyph size={12} />
      </span>
      {copied && (
        <span className="absolute inset-0 grid place-items-center rounded-sm bg-(--face-ink) text-white">
          <CheckGlyph size={12} />
        </span>
      )}
    </button>
  )
}
