import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportEntries, type ExportFormat } from '@/api/imports'
import { describeError } from '@/api/errors'
import { setSettingsSection, useVault } from '@/store'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import { LABEL } from '@/components/elements/tokens'
import Formats from './Formats'
import Warning from './Warning'

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

// A portable, unencrypted dump for another manager. CSV cells are sanitized
// against formula injection in the backend. Moving to another device of our
// own is what the encrypted backup is for, and the footer says so.
export default function ExportPane() {
  const { t } = useTranslation()
  const items = useVault(state => state.items)
  const [format, setFormat] = useState<ExportFormat>('bitwarden')
  const [acknowledged, setAcknowledged] = useState(false)
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    if (running || !acknowledged) return
    setRunning(true)
    setSaved(null)
    setError(null)
    exportEntries(format)
      .then(path => setSaved(path))
      .catch((e: unknown) => setError(describeError(e)))
      .finally(() => setRunning(false))
  }

  return (
    <div className="flex flex-col">
      <div className={cx(LABEL, 'mb-2')}>{t('Format')}</div>
      <Formats value={format} onChange={setFormat} label={t('Format')} />
      <Warning acknowledged={acknowledged} onAcknowledge={setAcknowledged} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-base text-text2">
          {t('Moving to another device?')}{' '}
          <button
            type="button"
            data-testid="settings-export-backup-link"
            onClick={() => setSettingsSection('sync')}
            className="cursor-pointer text-accent hover:underline"
          >
            {t('Save an encrypted backup instead')}
          </button>
        </p>
        <Button
          size="md"
          disabled={!acknowledged}
          loading={running}
          onClick={run}
          testid="settings-export-run"
        >
          {t('Export {{count}} items', { count: items.length })}
        </Button>
      </div>

      {(error || saved) && (
        <div className="mt-3 text-base">
          {error && <span className="text-bad">{error}</span>}
          {saved && (
            <span className="text-good">
              {t('Saved to')} {fileName(saved)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
