import { useState } from 'react'
import { exportEntries, type ExportFormat } from '@/lib/commands'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'
import Select from '@/components/elements/Select'
import { Section as Row, LABEL, DESC, DANGER, SUCCESS, StatusRow } from '../ui'

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
    <Row>
      <strong className={LABEL}>{t('Export vault')}</strong>
      <p className={DESC}>{t('Save every entry to a portable file')}</p>

      <Select
        name="export_format"
        value={format}
        disabled={running}
        onChange={e => setFormat(e.target.value as ExportFormat)}
        className="max-w-xs"
      >
        {FORMATS.map(f => (
          <option key={f.value} value={f.value}>
            {t(f.label)}
          </option>
        ))}
      </Select>

      <StatusRow>
        <Button onClick={run} loading={running}>
          {t('Export')}
        </Button>
        {error && <span className={DANGER}>{error}</span>}
        {saved && (
          <span className={SUCCESS}>
            {t('Saved to')} {fileName(saved)}
          </span>
        )}
      </StatusRow>
    </Row>
  )
}
