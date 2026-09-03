import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportVault } from '@/lib/commands'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import ExpandableRow from '../ExpandableRow'

// The whole vault as one `.swftx` file, resealed under the master password the
// user re-types here (the open session's key is never handed to the exporter).
export default function BackupRow() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onExport = () => {
    if (!password || exporting) return
    setExporting(true)
    setError(null)
    setSaved(false)
    exportVault(password)
      .then(() => {
        setPassword('')
        setSaved(true)
      })
      .catch(() => setError(t('Invalid master password')))
      .finally(() => setExporting(false))
  }

  return (
    <ExpandableRow
      label={t('Encrypted backup (.swftx)')}
      description={t('Your whole vault, sealed with your master password')}
      action={t('Save…')}
      testid="settings-backup-row"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="password"
          name="export_password"
          placeholder={t('Master password')}
          className={`${inputClass} max-w-xs`}
          value={password}
          disabled={exporting}
          onChange={event => {
            setError(null)
            setPassword(event.target.value)
          }}
        />
        <Button
          size="md"
          disabled={!password}
          loading={exporting}
          onClick={onExport}
          testid="settings-backup-save"
        >
          {t('Save')}
        </Button>
        {error && <span className="text-base text-bad">{error}</span>}
        {saved && <span className="text-base text-good">{t('Saved')}</span>}
      </div>
    </ExpandableRow>
  )
}
