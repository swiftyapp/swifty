import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { TKey } from '@/i18n'
import { MONO_LABEL, ROW_HAIRLINE } from '../tokens'
import { useFields } from './context'

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

// Where the value column starts: label 96 (w-24) + gap 12 + sigil 16 (w-4) + gap 12.
const VALUE_START = 'pl-[136px]'

// THE detail-row geometry: a w-24 mono label column, the value, trailing
// controls, then anything that belongs under the value. Read values and their
// editors both render through it, so switching modes never moves a row.
export default function FieldRow({ label, prefix, actions, below, error, children }: Props) {
  const { t } = useTranslation()
  const { set } = useFields()
  const labelled = label !== undefined
  const id = useId()

  return (
    // Editing, each input draws its own underline, so the hairline between
    // rows would be a second line for the same job; the read view keeps it.
    <div className={cx('item px-3.5 py-3', !set && ROW_HAIRLINE)}>
      <div className="flex items-center gap-3">
        {labelled && (
          <>
            <label htmlFor={id} className={`w-24 flex-none ${MONO_LABEL}`}>
              {t(label)}
            </label>
            {/* Held open with or without a sigil, so every value starts at one x. */}
            <span className="grid w-4 flex-none place-items-center text-text3">
              {prefix}
            </span>
          </>
        )}
        <div className="min-w-0 flex-1">{children(id)}</div>
        {/* Two 28px controls wide (28 + gap 4 + 28), held open so every value —
            and every editor's underline — ends at one x too. */}
        {labelled ? (
          <div className="flex w-[60px] flex-none items-center justify-end gap-1">
            {actions}
          </div>
        ) : (
          actions
        )}
      </div>
      {(below || error) && (
        <div className={cx('mt-1.5 flex flex-col gap-1.5', labelled && VALUE_START)}>
          {below}
          {error && <span className="text-base text-bad">{error}</span>}
        </div>
      )}
    </div>
  )
}
