import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportVault } from '@/api/vault'
import { BACKUP_EXTENSION } from '@/lib/backup'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { verbatimInput } from '@/components/elements/inputProps'
import { META, ROW_HAIRLINE } from '@/components/elements/tokens'
import { DiskGlyph } from '../../../../icons'
import RowHead from './RowHead'

// The whole vault as one backup file, resealed under the master password the
// user re-types here (the open session's key is never handed to the exporter).
// Unfolds its form under the row, as ExpandableRow does; laid out by hand only
// because its label carries the extension chip.
export default function BackupRow() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
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
    <div data-testid="settings-backup-row" className={cx('px-4 py-3.5', ROW_HAIRLINE)}>
      <div className="flex items-center gap-3.5">
        <RowHead
          icon={<DiskGlyph size={16} />}
          label={
            <>
              {t('Encrypted backup')}
              <span className={`rounded-xs border border-line2 px-1 font-normal ${META}`}>
                {BACKUP_EXTENSION}
              </span>
            </>
          }
          description={t('Your whole vault, sealed with your master password')}
        />
        <Button variant="pale" size="md" className="flex-none" onClick={() => setOpen(!open)}>
          {open ? t('Cancel') : t('Save…')}
        </Button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-3 pl-[46px]">
          <input
            type="password"
            name="export_password"
            {...verbatimInput}
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
          {error && <span className="text-sm text-bad">{error}</span>}
          {saved && <span className="text-sm text-good">{t('Saved')}</span>}
        </div>
      )}
    </div>
  )
}
