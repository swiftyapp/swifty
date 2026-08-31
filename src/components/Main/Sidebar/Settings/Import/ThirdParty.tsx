import { useState } from 'react'
import { cx } from '@/utils/cx'
import { setEntries } from '@/store'
import {
  pickImportFile,
  importEntries,
  readVault,
  type ImportFormat,
  type ImportReport
} from '@/lib/commands'
import { t } from '@/i18n'
import { useProgress } from './useProgress'
import Progress from './Progress'
import RowErrors from './RowErrors'

const FORMATS: { value: ImportFormat; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'bitwarden', label: 'Bitwarden (JSON)' },
  { value: 'chrome', label: 'Chrome / Safari (CSV)' },
  { value: 'lastpass', label: 'LastPass (CSV)' },
  { value: 'keepass', label: 'KeePass (CSV)' },
  { value: 'csv', label: 'Generic CSV' }
]

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

// Import from another password manager: pick a file + format, preview (dry run),
// then commit. A preview and the final result both surface per-row errors.
export default function ThirdParty() {
  const [path, setPath] = useState<string | null>(null)
  const [format, setFormat] = useState<ImportFormat>('auto')
  const [preview, setPreview] = useState<ImportReport | null>(null)
  const [result, setResult] = useState<ImportReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { progress, reset } = useProgress()

  const clear = () => {
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const choose = () =>
    pickImportFile().then(chosen => {
      if (chosen) {
        setPath(chosen)
        clear()
      }
    })

  const runPreview = () => {
    if (!path || running) return
    setRunning(true)
    clear()
    importEntries(path, format, true)
      .then(setPreview)
      .catch(e => setError(String(e)))
      .finally(() => setRunning(false))
  }

  const commit = () => {
    if (!path || running) return
    setRunning(true)
    setError(null)
    reset()
    importEntries(path, format, false)
      .then(async report => {
        setEntries(await readVault())
        setResult(report)
        setPreview(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setRunning(false))
  }

  return (
    <div className="section">
      <strong>{t('Import from another app')}</strong>
      <div>{t('Bitwarden, Chrome, Safari, LastPass, KeePass or a generic CSV')}</div>

      <div className="select">
        <select
          name="import_format"
          value={format}
          disabled={running}
          onChange={e => {
            setFormat(e.target.value as ImportFormat)
            clear()
          }}
        >
          {FORMATS.map(f => (
            <option key={f.value} value={f.value}>
              {t(f.label)}
            </option>
          ))}
        </select>
      </div>

      <div className={cx('button pale', { disabled: running })} onClick={choose}>
        {path ? fileName(path) : t('Choose file')}
      </div>

      {preview && (
        <div className="import-preview">
          <div>
            {t('Ready to import')}: <strong>{preview.total}</strong>
            {preview.skipped > 0 && (
              <span className="danger">
                {' '}
                · {preview.skipped} {t('rows skipped')}
              </span>
            )}
          </div>
          <RowErrors errors={preview.errors} />
        </div>
      )}

      {running && <Progress done={progress.done} total={progress.total} />}

      <div className="status-button">
        {!preview ? (
          <span
            onClick={runPreview}
            className={cx('button pale', { disabled: !path || running })}
          >
            {t('Preview')}
          </span>
        ) : (
          <span
            onClick={commit}
            className={cx('button', { disabled: running, loading: running })}
          >
            {t('Import')} {preview.total}
          </span>
        )}
        {error && <span className="danger">{error}</span>}
        {result && (
          <span className="success">
            {t('Imported')} {result.imported}
            {result.skipped > 0 && ` · ${result.skipped} ${t('skipped')}`}
          </span>
        )}
      </div>

      {result && <RowErrors errors={result.errors} />}
    </div>
  )
}
