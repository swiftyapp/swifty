import { t } from '@/i18n'
import { useField } from './context'
import FieldRow from './Row'

// Set to its own content height, so the body is never a two-line window onto a
// twenty-line note.
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`
}

export default function NoteField({
  name = 'note',
  label
}: {
  name?: string
  /** Omitted for a note entry, whose body owns the whole panel. */
  label?: string
}) {
  const { value, set, editing } = useField(name)

  if (!editing && value === '') return null

  return (
    <FieldRow label={label}>
      {editing ? (
        <textarea
          name={name}
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
      )}
    </FieldRow>
  )
}
