import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import Panel from '@/components/elements/Panel'
import { RAIL, grow, useField } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import { BLOCK_DOTS } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { BOX, BOX_LINE } from './styles'

// Long files scroll inside the well rather than pushing the metadata line off
// the screen; the same cap holds the editor, which grows to it and then scrolls.
const WELL = 'max-h-[60vh] overflow-y-auto'

// The raw text. Reading, it is the SSH private-key block, taller: masked as one
// block until the rail's eye is pressed, with copy always at hand. Editing, a
// plain textarea over the same string — power users fix quoting or comments
// here, and the table is never out of date because there is only one source.
export default function FileTab() {
  const { t } = useTranslation()
  const { value, set, editing, attempted } = useField('body')
  const [show, setShow] = useState(false)
  const error = requiredError(value, true, attempted)

  return (
    <Panel>
      {editing ? (
        <div className="px-3.5 py-3">
          <textarea
            name="body"
            aria-label={t('File')}
            value={value}
            rows={1}
            placeholder="KEY=value"
            spellCheck={false}
            ref={grow}
            onChange={event => {
              grow(event.currentTarget)
              set(event.target.value)
            }}
            className={cx(
              'block min-h-6 w-full resize-none font-mono text-base leading-relaxed text-text',
              WELL,
              BOX,
              error ? 'border-bad' : BOX_LINE
            )}
          />
          {error && <div className="mt-1.5 text-base text-bad">{error}</div>}
        </div>
      ) : (
        <div className="flex items-start gap-3 px-3.5 py-3">
          <div className={cx('min-w-0 flex-1', WELL)}>
            <div
              data-testid="entry-value-body"
              className={cx(
                'break-all font-mono text-base leading-relaxed',
                show ? 'whitespace-pre-wrap text-text' : 'text-text2'
              )}
            >
              {show ? value : BLOCK_DOTS}
            </div>
          </div>
          <div className={RAIL}>
            <CopyButton value={value} title={t('Copy')} />
            <IconButton
              title={show ? t('Hide') : t('Reveal')}
              active={show}
              testid="reveal-body"
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </IconButton>
          </div>
        </div>
      )}
    </Panel>
  )
}
