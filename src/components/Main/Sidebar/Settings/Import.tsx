import { useState, useEffect, type ChangeEvent } from 'react'
import { cx } from '@/utils/cx'
import { setEntries } from '@/store'
import { pickBackup, importSwftx, readVault } from '@/lib/commands'
import { on, EVENTS } from '@/lib/events'
import { t } from '@/i18n'
import type { Section } from './Navigation'

interface Props {
  section: Section
}

const fileName = (path: string) => path.replace(/^.*[\\/]/, '')

export default function Import({ section }: Props) {
  const [path, setPath] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The backend streams progress off the UI thread while re-encrypting entries.
  useEffect(() => {
    const pending = on(EVENTS.importProgress, setProgress)
    return () => {
      pending.then(unlisten => unlisten()).catch(() => {})
    }
  }, [])

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
    setProgress({ done: 0, total: 0 })
    importSwftx(path, password)
      .then(async imported => {
        // Refresh the list so the merged entries appear without a re-unlock.
        setEntries(await readVault())
        setCount(imported)
      })
      .catch(() => setError(t('Invalid password for backup')))
      .finally(() => setRunning(false))
  }

  if (section !== 'import') return null

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <>
      <h1>{t('Import Vault')}</h1>
      <div className="section">
        <strong>{t('Import from .swftx')}</strong>
        <div>{t('Merge entries from a Swifty vault file into your current vault')}</div>
        <div className={cx('button pale', { disabled: running })} onClick={choose}>
          {path ? fileName(path) : t('Choose backup File')}
        </div>
      </div>
      {path && (
        <div className="section">
          <strong>{t('Vault File Password')}</strong>
          <div className="threefour">
            <input
              type="password"
              name="import_password"
              value={password}
              disabled={running}
              onChange={onChange}
            />
          </div>
        </div>
      )}
      {running && (
        <div className="import-progress">
          <div className="bar">
            <div className="fill" style={{ width: `${pct}%` }} />
          </div>
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
      )}
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
    </>
  )
}
