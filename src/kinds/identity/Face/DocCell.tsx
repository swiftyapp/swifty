import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { META_TYPE } from '@/components/elements/tokens'
import { daysUntil, formatDate, relativeFuture } from '@/utils/time'
import { specOf, type IdentityKey } from '../templates'
import Cell from './Cell'

/** What a face reads from: the document's values, and whether its secrets show. */
export interface Doc {
  /** A stored value, '' unless this document's template has a row for it. */
  value: (key: IdentityKey) => string
  shown: boolean
  toggle: () => void
}

interface Props {
  doc: Doc
  name: IdentityKey
  /** Drop the caption: the header prints the country code on its own. */
  bare?: boolean
  ink?: string
  wrap?: boolean
  className?: string
}

const DOTS = '•'.repeat(10)

// One row of the template, printed on the face. The template's spec says what
// the value is — a date, a secret, a date the document dies on — and this turns
// that into how it shows, the same way the form's rows do for the editor.
export default function DocCell({ doc, name, bare, ink, wrap, className }: Props) {
  const { t } = useTranslation()
  const spec = specOf(name)
  const value = doc.value(name)
  if (!value) return null

  const masked = spec.secret && !doc.shown
  const days = spec.expiry ? daysUntil(value) : null
  const hint =
    days === null ? undefined : (
      <span
        className={cx(
          'mt-0.5 block',
          META_TYPE,
          days < 0 ? 'text-[#B3261E]' : 'text-(--face-ink2)'
        )}
      >
        {days < 0 ? t('Expired') : relativeFuture(value)}
      </span>
    )

  return (
    <Cell
      name={name}
      label={bare ? undefined : spec.label}
      value={value}
      display={masked ? DOTS : spec.date ? formatDate(value) : value}
      hint={hint}
      ink={cx(ink ?? 'text-base', masked && 'text-(--face-ink2)')}
      wrap={wrap && !masked}
      className={className}
    />
  )
}
