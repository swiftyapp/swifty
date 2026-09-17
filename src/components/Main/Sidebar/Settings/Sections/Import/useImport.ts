import { useCallback, useEffect, useState } from 'react'
import { claimOpenedFile, setEntries, useApp } from '@/store'
import { importSwftx } from '@/api/vault'
import { importEntries, type ImportFormat, type ImportReport } from '@/api/imports'
import { syncNow } from '@/api/sync'
import { pickImportFile, pickBackup } from '@/api/pickers'
import { describeError, errorKind } from '@/api/errors'
import { isBackupFile } from '@/lib/backup'
import { t } from '@/i18n'
import { useProgress } from './useProgress'

// Either a third-party export (parsed by the backend under `format`), a legacy
// `.swftx` vault, which is independently encrypted and needs its own password,
// or a `.rowel` backup — which is a whole sealed database and restores a fresh
// install rather than merging into this one, so it is only ever named here to
// say so (it arrives through the OS opening it with the app, never a tile).
export type Picked =
  | { kind: 'format'; format: ImportFormat; path: string }
  | { kind: 'swftx'; path: string }
  | { kind: 'rowel'; path: string }

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
    // A backup cannot be inspected without its password, so it waits for
    // input; a `.rowel` is not imported at all.
    if (next.kind !== 'format') return
    setRunning(true)
    importEntries(next.path, next.format, true)
      .then(setPreview)
      .catch((e: unknown) => setError(describeError(e)))
      .finally(() => setRunning(false))
  }, [])

  // A backup the OS opened with the app, once this section is on screen: a
  // legacy `.swftx` is picked as the tile would have picked it; a `.rowel` is
  // named and turned down (see `Picked`).
  const opened = useApp(state => state.openedFile)
  useEffect(() => {
    if (!opened) return
    claimOpenedFile()
    start({ kind: isBackupFile(opened) ? 'rowel' : 'swftx', path: opened })
  }, [opened, start])

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
      .then(report => {
        setEntries(report.entries)
        setResult(report)
        setPreview(null)
      })
      .catch((e: unknown) => setError(describeError(e)))
      .finally(() => setRunning(false))
  }

  const runBackup = (password: string) => {
    if (picked?.kind !== 'swftx' || running) return
    setRunning(true)
    setError(null)
    setCount(null)
    reset()
    importSwftx(picked.path, password)
      .then(({ count, entries }) => {
        setEntries(entries)
        setCount(count)
        // Publish the imported entries; a no-op when sync is not configured.
        syncNow().catch(() => {})
      })
      .catch((e: unknown) =>
        setError(
          errorKind(e) === 'invalidPassword' ? t('Invalid password for backup') : describeError(e)
        )
      )
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
