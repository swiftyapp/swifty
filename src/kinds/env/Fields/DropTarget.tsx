import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { isMobile } from '@/lib/platform'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { dialogOpen } from '@/utils/dialogOpen'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import { useFields } from '@/components/elements/fields'
import { CloseGlyph, DownloadGlyph } from '@/components/Main/icons'
import { mergeNewKeys, type IngestedEnv } from '../ingest'
import { useEnvIngest } from '../useIngest'

// The import zone's dress, so the two read as the same affordance.
const ZONE =
  'mt-3 flex items-center gap-3.5 rounded-lg border border-dashed border-line2 px-4 py-5 text-text3'

function PendingPrompt({
  file,
  apply,
  close
}: {
  file: IngestedEnv
  apply: (mode: 'replace' | 'merge') => void
  close: () => void
}) {
  const { t } = useTranslation()
  const prompt = useRef<HTMLDivElement>(null)
  useDialogFocus(prompt, close)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    // The shared dialog hook closes at window level; keep the editor's document
    // listener (and any other surface behind this prompt) from seeing the key.
    event.stopPropagation()
    event.preventDefault()
    close()
  }

  return (
    <div
      ref={prompt}
      role="dialog"
      aria-labelledby="env-drop-question"
      tabIndex={-1}
      data-testid="env-drop-prompt"
      onKeyDown={onKeyDown}
      className={cx(ZONE, 'flex-wrap justify-between border-accent-line')}
    >
      <span id="env-drop-question" className="min-w-0 flex-1 text-base text-text2">
        {t('Replace everything with {{name}}, or add only the keys not already here?', {
          name: file.fileName
        })}
      </span>
      <div className="flex items-center gap-2">
        <Button size="md" testid="env-drop-replace" onClick={() => apply('replace')}>
          {t('Replace')}
        </Button>
        <Button size="md" variant="pale" testid="env-drop-merge" onClick={() => apply('merge')}>
          {t('Merge new keys')}
        </Button>
        <IconButton title={t('Cancel')} testid="env-drop-cancel" onClick={close}>
          <CloseGlyph />
        </IconButton>
      </div>
    </div>
  )
}

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
  const body = typeof entry.body === 'string' ? entry.body : ''
  const title = typeof entry.title === 'string' ? entry.title : ''

  const apply = (file: IngestedEnv, mode: 'replace' | 'merge') => {
    set?.('body', mode === 'merge' ? mergeNewKeys(body, file.body) : file.body)
    set?.('fileName', file.fileName)
    if (!title.trim()) set?.('title', file.title)
    setPending(null)
  }

  // `useEnvIngest` publishes to this callback's latest render. If typing happens
  // while the file is read, this body — not the blank body at drop time — wins.
  const ingest = useEnvIngest(file => {
    if (!body.trim()) apply(file, 'replace')
    else setPending(file)
  })

  // Settings › Import is a dialog with a drop zone of its own; while it is up
  // a drop means an export, not an env file for the draft behind it.
  useFileDrop(([path]) => {
    if (path && !dialogOpen()) void ingest.drop(path)
  }, !!set)

  if (!set) return null

  if (pending) {
    return (
      <PendingPrompt
        file={pending}
        apply={mode => apply(pending, mode)}
        close={() => setPending(null)}
      />
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
          onClick={() => void ingest.pick()}
          className={cx(ZONE, 'w-full cursor-pointer transition-colors hover:border-accent-line')}
        >
          {label}
        </button>
      ) : (
        <div data-testid="env-dropzone" className={ZONE}>
          {label}
        </div>
      )}
      {ingest.error && (
        <div data-testid="env-drop-error" className="mt-1.5 text-base text-bad">
          {ingest.error}
        </div>
      )}
    </>
  )
}
