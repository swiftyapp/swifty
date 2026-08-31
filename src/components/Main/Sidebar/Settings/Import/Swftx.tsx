import { useState, type ChangeEvent } from 'react'
import { cx } from '@/utils/cx'
import { setEntries } from '@/store'
import { pickBackup, importSwftx, readVault } from '@/lib/commands'
import { t } from '@/i18n'
import { useProgress } from './useProgress'
import Progress from './Progress'

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
      })
      .catch(() => setError(t('Invalid password for backup')))
      .finally(() => setRunning(false))
  }

  return (
    <div className="section">
      <strong>{t('Import from .swftx')}</strong>
      <div>{t('Merge entries from a Swifty vault file into your current vault')}</div>
      <div className={cx('button pale', { disabled: running })} onClick={choose}>
        {path ? fileName(path) : t('Choose backup File')}
      </div>
      {path && (
        <div className="threefour">
          <input
            type="password"
            name="import_password"
            placeholder={t('Vault File Password')}
            value={password}
            disabled={running}
            onChange={onChange}
          />
        </div>
      )}
      {running && <Progress done={progress.done} total={progress.total} />}
      <div className="status-button">
        <span
          onClick={run}
          className={cx('button', { disabled: !path || running, loading: running })}
        >
          {t('Run import')}
        </span>
        {error && <span className="danger">{error}</span>}
        {count !== null && (
          <span className="success">
            {t('Imported')} {count}
          </span>
        )}
      </div>
    </div>
  )
}
