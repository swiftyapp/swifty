import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { useField } from './context'
import { requiredError } from './formats'
import FieldRow from './Row'

// Set to its own content height, so a twenty-line note is never read through a
// two-line window.
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`
}

export default function NoteField({
  name = 'note',
  label,
  required
}: {
  name?: string
  /** Omitted for a note entry, whose body owns the whole panel. */
  label?: TKey
  required?: boolean
}) {
  const { t } = useTranslation()
  const { value, set, editing, attempted } = useField(name)

  if (!editing && value === '') return null

  return (
    <FieldRow label={label} error={requiredError(value, required, attempted)}>
      {id =>
        editing ? (
          <textarea
            id={id}
            name={name}
            // A note entry's body is a full-bleed row: there is no label column
            // to point at it, so it names itself.
            aria-label={label === undefined ? t('Note') : undefined}
            value={value}
            rows={1}
            placeholder={t('Anything worth remembering')}
            spellCheck={false}
            ref={grow}
            onChange={event => {
              grow(event.currentTarget)
              set(event.target.value)
            }}
            className="block min-h-6 w-full resize-none overflow-hidden border-b border-line2 bg-transparent text-base leading-relaxed text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
          />
        ) : (
          <div
            className="whitespace-pre-wrap break-words text-base leading-relaxed text-text2"
            data-testid={`entry-value-${name}`}
          >
            {value}
          </div>
        )
      }
    </FieldRow>
  )
}
