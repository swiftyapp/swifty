import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { isMobile } from '@/lib/platform'
import { pickEnvFile } from '@/lib/commands'
import { useFileDrop } from '@/hooks/useFileDrop'
import { dialogOpen } from '@/utils/dialogOpen'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import { useFields } from '@/components/elements/fields'
import { CloseGlyph, DownloadGlyph } from '@/components/Main/icons'
import { ingestEnvFile, mergeNewKeys, type IngestedEnv } from '../ingest'

// The import zone's dress, so the two read as the same affordance.
const ZONE =
  'mt-3 flex items-center gap-3.5 rounded-lg border border-dashed border-line2 px-4 py-5 text-text3'

/**
 * The dashed target at the foot of the editor. A file dropped here becomes the
 * draft: onto an empty one it simply lands, name and proposed title included;
 * onto one with variables already in it the zone turns into the question —
 * replace the file, or add only the keys it does not have yet. On a phone the
 * zone is a button that opens the file picker, as the import zone's is.
 *
 * Rendered in edit mode only: the `set` it writes through is the mode switch.
 */
export default function DropTarget() {
  const { t } = useTranslation()
  const { entry, set } = useFields()
  const [pending, setPending] = useState<IngestedEnv | null>(null)
  const [error, setError] = useState<string | null>(null)
  const body = typeof entry.body === 'string' ? entry.body : ''
  const title = typeof entry.title === 'string' ? entry.title : ''

  const apply = (file: IngestedEnv, mode: 'replace' | 'merge') => {
    set?.('body', mode === 'merge' ? mergeNewKeys(body, file.body) : file.body)
    set?.('fileName', file.fileName)
    if (!title.trim()) set?.('title', file.title)
    setPending(null)
  }

  const take = (path: string) =>
    ingestEnvFile(path)
      .then(file => {
        setError(null)
        // Nothing typed yet, so there is nothing to ask about.
        if (!body.trim()) apply(file, 'replace')
        else setPending(file)
      })
      .catch(e => setError(String(e)))

  // Settings › Import is a dialog with a drop zone of its own; while it is up
  // a drop means an export, not an env file for the draft behind it.
  useFileDrop(([path]) => {
    if (path && !dialogOpen()) void take(path)
  }, !!set)

  const pick = () =>
    pickEnvFile()
      .then(path => {
        if (path) return take(path)
      })
      .catch(() => {})

  // Escape here answers the question, not the editor: `useDraft` hears Escape
  // on the document as Cancel, so it must not travel past the zone.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    setPending(null)
  }

  if (!set) return null

  if (pending) {
    return (
      <div
        data-testid="env-drop-prompt"
        onKeyDown={onKeyDown}
        className={cx(ZONE, 'flex-wrap justify-between border-accent-line')}
      >
        <span className="min-w-0 flex-1 text-base text-text2">
          {t('Replace everything with {{name}}, or add only the keys not already here?', {
            name: pending.fileName
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button size="md" testid="env-drop-replace" onClick={() => apply(pending, 'replace')}>
            {t('Replace')}
          </Button>
          <Button
            size="md"
            variant="pale"
            testid="env-drop-merge"
            onClick={() => apply(pending, 'merge')}
          >
            {t('Merge new keys')}
          </Button>
          <IconButton title={t('Cancel')} testid="env-drop-cancel" onClick={() => setPending(null)}>
            <CloseGlyph />
          </IconButton>
        </div>
      </div>
    )
  }

  const label = (
    <>
      <DownloadGlyph size={16} />
      <span className="min-w-0 text-left text-base text-text2">
        {isMobile
          ? t('Choose a .env file')
          : t('Drop a .env file here, or paste KEY=VALUE lines into any row')}
      </span>
    </>
  )

  return (
    <>
      {isMobile ? (
        <button
          type="button"
          data-testid="env-dropzone"
          onClick={() => void pick()}
          className={cx(ZONE, 'w-full cursor-pointer transition-colors hover:border-accent-line')}
        >
          {label}
        </button>
      ) : (
        <div data-testid="env-dropzone" className={ZONE}>
          {label}
        </div>
      )}
      {error && (
        <div data-testid="env-drop-error" className="mt-1.5 text-base text-bad">
          {error}
        </div>
      )}
    </>
  )
}
