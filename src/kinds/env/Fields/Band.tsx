import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AddAction from '@/components/elements/AddAction'
import { LABEL } from '@/components/elements/tokens'

interface Props {
  /** The comment block above the band's first variable, or null. */
  caption: string | null
  index: number
  /** Editing only: appends a row to this band. */
  onAdd?: () => void
  /** The band's rows — and, editing, the row being added to it last. */
  children: ReactNode
}

// One run of variables under the comment that captioned it. A well-kept file
// lays itself out this way with no effort from the user, so the caption is
// shown as written (the label face does the uppercasing) and never edited here.
// The caller withholds it from a masked read view because it came from the same
// secret body as the values. The add button is once per band so a new row lands
// in the band it was asked for.
export default function Band({ caption, index, onAdd, children }: Props) {
  const { t } = useTranslation()

  return (
    <div>
      {caption && <div className={`px-3.5 pt-3 ${LABEL}`}>{caption}</div>}
      {children}
      {onAdd && (
        <div className="flex justify-end px-3.5 pb-3">
          <AddAction label={t('Add variable')} testid={`add-env-var-${index}`} onClick={onAdd} />
        </div>
      )}
    </div>
  )
}
