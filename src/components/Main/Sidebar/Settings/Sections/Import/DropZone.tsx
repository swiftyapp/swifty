import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadGlyph } from '../../../../icons'

interface Props {
  onDrop: (path: string) => void
}

// Files dropped onto the window arrive as OS paths through the webview, not as
// a browser DataTransfer. The API is imported lazily so a non-Tauri host (the
// vitest jsdom run) simply never wires the listener up.
export default function DropZone({ onDrop }: Props) {
  const { t } = useTranslation()
  useEffect(() => {
    let alive = true
    let unlisten: (() => void) | undefined

    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent(event => {
          if (event.payload.type !== 'drop') return
          const [path] = event.payload.paths
          if (path) onDrop(path)
        })
      )
      .then(stop => {
        if (alive) unlisten = stop
        else stop()
      })
      .catch(() => {})

    return () => {
      alive = false
      unlisten?.()
    }
  }, [onDrop])

  return (
    <div
      data-testid="import-dropzone"
      className="flex items-center gap-3.5 rounded-lg border border-dashed border-line2 px-4 py-5 text-text3"
    >
      <DownloadGlyph size={16} />
      <div className="min-w-0">
        <div className="text-base text-text2">{t('Or drop an export file here')}</div>
        <div className="font-mono text-xs">
          {t('csv, json — parsed locally, never uploaded')}
        </div>
      </div>
    </div>
  )
}
