import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { TKey } from '@/i18n'
import { MONO_LABEL, ROW_HAIRLINE } from '../tokens'

interface Props {
  /** Untranslated. Omitted for a full-bleed row — a note body. */
  label?: TKey
  /** A sigil in front of the value: what makes a URL look like a URL. */
  prefix?: ReactNode
  /** Trailing controls: reveal, copy, open, generate. */
  actions?: ReactNode
  /** Full-width slot under the value: a strength bar, a rotation stamp. */
  below?: ReactNode
  /** Rendered under the value once there is something to complain about. */
  error?: string
  /**
   * Given the id the row's `<label>` points at, so the control it renders
   * carries an accessible name. A full-bleed row has no label to hand over and
   * names its own control instead.
   */
  children: (id: string) => ReactNode
}

// THE detail-row geometry: a w-24 mono label column, the value, trailing
// controls, then anything that belongs under the value. Read values and their
// editors both render through it, so switching modes never moves a row.
export default function FieldRow({ label, prefix, actions, below, error, children }: Props) {
  const { t } = useTranslation()
  const labelled = label !== undefined
  const id = useId()

  return (
    <div className={cx('item px-3.5 py-3', ROW_HAIRLINE)}>
      <div className="flex items-center gap-3">
        {labelled && (
          <label htmlFor={id} className={`w-24 flex-none ${MONO_LABEL}`}>
            {t(label)}
          </label>
        )}
        {prefix && <span className="flex-none text-text3">{prefix}</span>}
        <div className="min-w-0 flex-1">{children(id)}</div>
        {actions}
      </div>
      {(below || error) && (
        <div className={cx('mt-1.5 flex flex-col gap-1.5', labelled && 'pl-[108px]')}>
          {below}
          {error && <span className="text-base text-bad">{error}</span>}
        </div>
      )}
    </div>
  )
}
