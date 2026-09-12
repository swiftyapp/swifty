import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LABEL } from '@/components/elements/tokens'
import { PlusGlyph } from '@/components/Main/icons'

// The accent-text button CustomFields ends with, here once per band so a new
// row lands in the band it was asked for.
export function AddVariable({ testid, onClick }: { testid: string; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 text-base text-accent hover:brightness-110"
    >
      <PlusGlyph size={13} />
      <span>{t('Add variable')}</span>
    </button>
  )
}

interface Props {
  /** The comment block above the band's first variable, or null. */
  caption: string | null
  index: number
  /** Editing only: appends a row to this band. */
  onAdd?: () => void
  /** The row being added to this band, rendered after the stored ones. */
  pending?: ReactNode
  children: ReactNode
}

// One run of variables under the comment that captioned it. A well-kept file
// lays itself out this way with no effort from the user, so the caption is
// shown as written (the label face does the uppercasing) and never edited here
// — it is a comment, and the File tab is where comments are.
export default function Band({ caption, index, onAdd, pending, children }: Props) {
  return (
    <div>
      {caption && <div className={`px-3.5 pt-3 ${LABEL}`}>{caption}</div>}
      {/* The rows are their own scope, so the hairline stops at the band's
          last row (ROW_HAIRLINE drops it on `last`) rather than the button. */}
      <div>{children}</div>
      {pending}
      {onAdd && (
        <div className="flex justify-end px-3.5 pb-3">
          <AddVariable testid={`add-env-var-${index}`} onClick={onAdd} />
        </div>
      )}
    </div>
  )
}
