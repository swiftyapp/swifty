import { useState, type ChangeEvent } from 'react'
import { setEntries } from '@/store'
import { pickBackup, importSwftx, readVault, syncNow } from '@/lib/commands'
import { t } from '@/i18n'
import { useProgress } from './useProgress'
import Progress from './Progress'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { Section as Row, LABEL, DESC, DANGER, SUCCESS, StatusRow } from '../ui'

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

// Merge a Swifty `.swftx` backup (independently encrypted) into the open vault.
export default function Swftx() {
  const [path, setPath] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { progress, reset } = useProgress()

  const choose = () =>
    pickBackup().then(chosen => {
      if (chosen) {
        setPath(chosen)
        setCount(null)
        setError(null)
      }
    })

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.target.value)
  }

  const run = () => {
    if (!path || running) return
    setRunning(true)
    setError(null)
    setCount(null)
    reset()
    importSwftx(path, password)
      .then(async imported => {
        setEntries(await readVault())
        setCount(imported)
        // Publish the imported entries; a no-op when sync is not configured.
        syncNow().catch(() => {})
      })
      .catch(() => setError(t('Invalid password for backup')))
      .finally(() => setRunning(false))
  }

  return (
    <Row>
      <strong className={LABEL}>{t('Import from .swftx')}</strong>
      <p className={DESC}>
        {t('Merge entries from a Swifty vault file into your current vault')}
      </p>
      <div>
        <Button variant="pale" disabled={running} onClick={choose}>
          {path ? fileName(path) : t('Choose backup File')}
        </Button>
      </div>
      {path && (
        <input
          type="password"
          name="import_password"
          placeholder={t('Vault File Password')}
          className={`${inputClass} max-w-md`}
          value={password}
          disabled={running}
          onChange={onChange}
        />
      )}
      {running && <Progress done={progress.done} total={progress.total} />}
      <StatusRow>
        <Button onClick={run} disabled={!path} loading={running}>
          {t('Run import')}
        </Button>
        {error && <span className={DANGER}>{error}</span>}
        {count !== null && (
          <span className={SUCCESS}>
            {t('Imported')} {count}
          </span>
        )}
      </StatusRow>
    </Row>
  )
}
