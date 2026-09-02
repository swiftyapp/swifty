import { useCallback, useState } from 'react'
import { setEntries } from '@/store'
import {
  pickImportFile,
  pickBackup,
  importEntries,
  importSwftx,
  readVault,
  syncNow,
  type ImportFormat,
  type ImportReport
} from '@/lib/commands'
import { t } from '@/i18n'
import { useProgress } from './useProgress'

// Either a third-party export (parsed by the backend under `format`) or a
// Swifty backup, which is independently encrypted and needs its own password.
export type Picked =
  | { kind: 'format'; format: ImportFormat; path: string }
  | { kind: 'swftx'; path: string }

// One import flow for every tile: pick or drop a file, preview it (dry run),
// then commit. Preview and result both surface per-row errors.
export function useImport() {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [preview, setPreview] = useState<ImportReport | null>(null)
  const [result, setResult] = useState<ImportReport | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { progress, reset } = useProgress()

  const start = useCallback((next: Picked) => {
    setPicked(next)
    setPreview(null)
    setResult(null)
    setCount(null)
    setError(null)
    // A backup cannot be inspected without its password, so it waits for input.
    if (next.kind === 'swftx') return
    setRunning(true)
    importEntries(next.path, next.format, true)
      .then(setPreview)
      .catch(e => setError(String(e)))
      .finally(() => setRunning(false))
  }, [])

  const chooseFile = useCallback(
    (format: ImportFormat) =>
      pickImportFile().then(path => {
        if (path) start({ kind: 'format', format, path })
      }),
    [start]
  )

  const chooseBackup = useCallback(
    () =>
      pickBackup().then(path => {
        if (path) start({ kind: 'swftx', path })
      }),
    [start]
  )

  // A dropped file has no tile behind it, so the backend sniffs the format.
  const dropped = useCallback(
    (path: string) => start({ kind: 'format', format: 'auto', path }),
    [start]
  )

  const commit = () => {
    if (picked?.kind !== 'format' || running) return
    setRunning(true)
    setError(null)
    reset()
    importEntries(picked.path, picked.format, false)
      .then(async report => {
        setEntries(await readVault())
        setResult(report)
        setPreview(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setRunning(false))
  }

  const runBackup = (password: string) => {
    if (picked?.kind !== 'swftx' || running) return
    setRunning(true)
    setError(null)
    setCount(null)
    reset()
    importSwftx(picked.path, password)
      .then(async imported => {
        setEntries(await readVault())
        setCount(imported)
        // Publish the imported entries; a no-op when sync is not configured.
        syncNow().catch(() => {})
      })
      .catch(() => setError(t('Invalid password for backup')))
      .finally(() => setRunning(false))
  }

  return {
    picked,
    preview,
    result,
    count,
    running,
    error,
    progress,
    chooseFile,
    chooseBackup,
    dropped,
    commit,
    runBackup
  }
}
