import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExtraField } from '@/lib/commands'
import { cx } from '@/utils/cx'
import { TrashGlyph } from '../../../Main/icons'
import CopyButton from '../../CopyButton'
import IconButton from '../../IconButton'
import { MONO_LABEL, MONO_TYPE, ROW_HAIRLINE } from '../../tokens'

interface Props {
  field: ExtraField
  /** Position in the list: what the inputs are named and tested by. */
  index: number
  /** Editing only: writes this row back to the draft. */
  onChange?: (next: ExtraField) => void
  onRemove?: () => void
  /** Enter in the value box appends a row; offered only on the last one. */
  onAppend?: () => void
}

// The same value column in both modes, so switching does not move the row.
const INK = 'block h-6 w-full min-w-0 truncate font-mono text-base leading-6 text-text'
const BOX =
  'border-b border-line2 bg-transparent outline-none transition-colors placeholder:text-text3 focus:border-accent-line'

// One label/value pair, in the detail row's geometry: the label takes the w-24
// mono column the fixed rows use, the value the rest. Reading, the value gets a
// copy button like any other; editing, the label is typed too — it is the user's
// word for this field, not a translated one — and the row can be dropped.
export default function CustomFieldRow({
  field,
  index,
  onChange,
  onRemove,
  onAppend
}: Props) {
  const { t } = useTranslation()
  const editing = !!onChange

  // Enter is inert in the editor (only ⌘⏎ saves), so the last row can spend it
  // on the next one — filling a list never needs the mouse.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !onAppend) return
    event.preventDefault()
    onAppend()
  }

  return (
    <div className={cx('flex items-center gap-3 px-3.5 py-3', !editing && ROW_HAIRLINE)}>
      {onChange ? (
        <input
          name={`extra-label-${index}`}
          value={field.label}
          aria-label={t('Label')}
          placeholder={t('Label')}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          onChange={event => onChange({ ...field, label: event.target.value })}
          className={cx('w-24 flex-none text-text', MONO_TYPE, BOX)}
        />
      ) : (
        <span
          data-testid={`entry-extra-label-${index}`}
          className={cx('w-24 flex-none truncate', MONO_LABEL)}
        >
          {field.label}
        </span>
      )}
      {/* The fixed rows' sigil slot and actions slot (see FieldRow), held open
          so these values start and end where the rows above them do. */}
      <span className="w-4 flex-none" />

      <div className="min-w-0 flex-1">
        {onChange ? (
          <input
            name={`extra-value-${index}`}
            value={field.value}
            aria-label={t('Value')}
            placeholder={t('Value')}
            autoComplete="off"
            spellCheck={false}
            onChange={event => onChange({ ...field, value: event.target.value })}
            onKeyDown={onKeyDown}
            className={cx(INK, BOX)}
          />
        ) : (
          <span className={INK} data-testid={`entry-extra-value-${index}`}>
            {field.value}
          </span>
        )}
      </div>

      <div className="flex w-[60px] flex-none items-center justify-end gap-1">
        {editing ? (
          <IconButton
            title={t('Remove field')}
            testid={`remove-extra-${index}`}
            onClick={onRemove}
          >
            <TrashGlyph />
          </IconButton>
        ) : (
          <CopyButton value={field.value} title={t('Copy')} />
        )}
      </div>
    </div>
  )
}
