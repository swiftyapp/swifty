import { useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import IconButton from '@/components/elements/IconButton'
import { RAIL, STACK, STACK_LABEL, STACK_RAIL, grow, useFields } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import { TrashGlyph } from '@/components/Main/icons'
import { isValidKey, looksLikeEnv } from '../parse'
import { BOX, BOX_LINE, KEY_COL, focusEnd } from './styles'

interface Props {
  /** The line's index, or `new` for a row the file does not have yet. */
  name: string
  row: { key: string; value: string }
  /** Called with identifiers only; what is typed in between stays in the box. */
  onKey: (key: string) => void
  onValue: (value: string) => void
  onRemove: () => void
  /** Enter in the value box appends a row; offered only on a band's last one. */
  onAppend?: () => void
  /** A pasted block of `KEY=VALUE` lines, to become rows after this one. */
  onPaste: (text: string) => void
  /** Focus left the row altogether. */
  onLeave?: () => void
  /** The table's own complaint about this row — a duplicate key. */
  error?: string
  autoFocus?: boolean
}

// One variable, edited: a key box and a value box on the underlined style every
// other editor uses, with a remove at the rail. The value is a textarea that
// grows like the note editor's, because a quoted value may hold newlines; it
// starts at one line so the row is the same height as its read face.
export default function EditRow({
  name,
  row,
  onKey,
  onValue,
  onRemove,
  onAppend,
  onPaste,
  onLeave,
  error,
  autoFocus
}: Props) {
  const { t } = useTranslation()
  const { attempted } = useFields()
  // A key that is not (yet) an identifier cannot be written into the file — the
  // line would stop being a variable and the row would vanish. So the box holds
  // it here, with the complaint under it, until it is one or the caret leaves;
  // the file only ever learns identifiers. Null: the box shows the file's key.
  const [typed, setTyped] = useState<string | null>(null)
  const key = typed ?? row.key
  const keyError =
    key === '' ? requiredError('', true, attempted) : isValidKey(key) ? '' : t('Not a valid name')
  const complaint = error || keyError
  const line = complaint ? 'border-bad' : BOX_LINE

  const type = (next: string) => {
    if (!isValidKey(next)) return setTyped(next)
    setTyped(null)
    onKey(next)
  }

  // Enter is inert in the editor (only ⌘⏎ saves), and a value is one line far
  // more often than not, so plain Enter goes to the next row like CustomFields'
  // does; a newline inside a value is Shift+Enter.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    onAppend?.()
  }

  // A block of variables pasted into a key box becomes rows, not a key. This
  // is how a file arrives from a chat window, and the only ingest on a phone.
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!looksLikeEnv(text)) return
    event.preventDefault()
    onPaste(text)
  }

  // Leaving the row with a half-typed key puts the file's key back: nothing
  // was written, so nothing is lost, and the row does not sit there in red.
  const leave = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setTyped(null)
    onLeave?.()
  }

  return (
    <div className="px-3.5 py-3" onBlur={leave}>
      <div className={cx('flex items-center gap-3', STACK)}>
        <input
          name={`env-key-${name}`}
          value={key}
          aria-label={t('Name')}
          placeholder={t('Name')}
          autoComplete="off"
          spellCheck={false}
          ref={autoFocus ? focusEnd : undefined}
          onChange={event => type(event.target.value)}
          onPaste={paste}
          className={cx(KEY_COL, 'text-text', BOX, line, STACK_LABEL)}
        />
        <div className="min-w-0 flex-1">
          <textarea
            name={`env-value-${name}`}
            value={row.value}
            aria-label={t('Value')}
            placeholder={t('Value')}
            rows={1}
            spellCheck={false}
            ref={grow}
            onChange={event => {
              grow(event.currentTarget)
              onValue(event.target.value)
            }}
            onKeyDown={onKeyDown}
            className={cx(
              'block min-h-6 w-full resize-none overflow-hidden font-mono text-base leading-6 text-text',
              BOX,
              line
            )}
          />
        </div>
        <div className={cx(RAIL, STACK_RAIL)}>
          <IconButton title={t('Remove variable')} testid={`remove-env-${name}`} onClick={onRemove}>
            <TrashGlyph />
          </IconButton>
        </div>
      </div>
      {complaint && <div className="mt-1.5 text-base text-bad">{complaint}</div>}
    </div>
  )
}
