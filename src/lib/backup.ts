/**
 * The backup file the app writes and restores (`export_vault`,
 * `setup_restore_from_file`). The same extension `BACKUP_EXTENSION` names in
 * Rust and the desktop file association registers in `tauri.conf.json`.
 */
export const BACKUP_EXTENSION = '.rowel'

/** Whether an OS path names one of our backups, by extension, case aside. */
export const isBackupFile = (path: string): boolean =>
  path.toLowerCase().endsWith(BACKUP_EXTENSION)
