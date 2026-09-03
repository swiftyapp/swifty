import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportEntries, type ExportFormat } from '@/lib/commands'
import type { TKey } from '@/i18n'
import Button from '@/components/elements/Button'
import Select from '@/components/elements/Select'
import SettingsRow from '@/components/elements/SettingsRow'

const FORMATS: { value: ExportFormat; label: TKey }[] = [
  { value: 'bitwarden', label: 'Bitwarden (JSON)' },
  { value: 'cxf', label: 'FIDO Credential Exchange (CXF)' },
  { value: 'csv', label: 'Generic CSV' }
]

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

// A portable, unencrypted dump — the one warning covers every format offered
// here. CSV cells are sanitized against formula injection in the backend.
export default function ExportRow() {
  const { t } = useTranslation()
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
    <SettingsRow
      label={t('Portable export')}
      description={t('Bitwarden JSON, FIDO CXF or generic CSV, unencrypted')}
      control={
        <div className="flex items-center gap-2">
          <Select
            name="export_format"
            value={format}
            disabled={running}
            onChange={e => setFormat(e.target.value as ExportFormat)}
            className="w-[228px]"
          >
            {FORMATS.map(f => (
              <option key={f.value} value={f.value}>
                {t(f.label)}
              </option>
            ))}
          </Select>
          <Button size="md" loading={running} onClick={run} testid="settings-export-run">
            {t('Export')}
          </Button>
        </div>
      }
    >
      {(error || saved) && (
        <div className="text-base">
          {error && <span className="text-bad">{error}</span>}
          {saved && (
            <span className="text-good">
              {t('Saved to')} {fileName(saved)}
            </span>
          )}
        </div>
      )}
    </SettingsRow>
  )
}
