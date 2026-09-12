import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { isMobile } from '@/lib/platform'
import { saveEnvFile } from '@/lib/commands'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import Panel from '@/components/elements/Panel'
import { grow, useField } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import { BLOCK_DOTS } from '@/components/elements/tokens'
import { DownloadGlyph, EyeGlyph, EyeOffGlyph } from '@/components/Main/icons'
import { BOX, BOX_LINE } from './styles'

// Long files scroll inside the well rather than pushing the metadata line off
// the screen; the same cap holds the editor, which grows to it and then scrolls.
const WELL = 'max-h-[60vh] overflow-y-auto'

// The raw text. Reading, it is the SSH private-key block, taller: masked as one
// block until the rail's eye is pressed, with copy always at hand. Editing, a
// plain textarea over the same string — power users fix quoting or comments
// here, and the table is never out of date because there is only one source.
//
// "Save as file…" sits in this rail rather than the header's ⋯ menu: it is the
// file tab's own action, and keeping it kind-local means the shared header
// needs no per-kind hook. Desktop only — the mobile picker copies the file
// itself and cannot be told what permissions to give a plaintext secret.
export default function FileTab() {
  const { t } = useTranslation()
  const { value, set, editing, attempted } = useField('body')
  const { value: fileName } = useField('fileName')
  const [show, setShow] = useState(false)
  const error = requiredError(value, true, attempted)

  // A dismissed dialog resolves to null and needs no reaction; a failed write
  // is the OS's message, which there is no better place to put than the log.
  const save = () => {
    saveEnvFile(fileName, value).catch(e => console.error(e))
  }

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
          {/* Three controls, not the detail rows' two: this block lines up with
              no row, so the rail sizes to what it holds. */}
          <div className="flex flex-none items-center gap-1">
            <CopyButton value={value} title={t('Copy')} />
            {!isMobile && (
              <IconButton title={t('Save as file…')} testid="env-save-file" onClick={save}>
                <DownloadGlyph />
              </IconButton>
            )}
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
