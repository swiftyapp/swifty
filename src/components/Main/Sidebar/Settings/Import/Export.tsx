import { useState } from 'react'
import { cx } from '@/utils/cx'
import { exportEntries, type ExportFormat } from '@/lib/commands'
import { t } from '@/i18n'

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'bitwarden', label: 'Bitwarden (JSON)' },
  { value: 'csv', label: 'Generic CSV' }
]

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

// Export the open vault to a portable format. CSV cells are sanitized against
// formula injection in the backend.
export default function Export() {
  const [format, setFormat] = useState<ExportFormat>('bitwarden')
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    if (running) return
    setRunning(true)
    setSaved(null)
    setError(null)
    exportEntries(format)
      .then(path => setSaved(path))
      .catch(e => setError(String(e)))
      .finally(() => setRunning(false))
  }

  return (
    <div className="section">
      <strong>{t('Export vault')}</strong>
      <div>{t('Save every entry to a portable file')}</div>

      <div className="select">
        <select
          name="export_format"
          value={format}
          disabled={running}
          onChange={e => setFormat(e.target.value as ExportFormat)}
        >
          {FORMATS.map(f => (
            <option key={f.value} value={f.value}>
              {t(f.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="status-button">
        <span onClick={run} className={cx('button', { loading: running })}>
          {t('Export')}
        </span>
        {error && <span className="danger">{error}</span>}
        {saved && (
          <span className="success">
            {t('Saved to')} {fileName(saved)}
          </span>
        )}
      </div>
    </div>
  )
}
