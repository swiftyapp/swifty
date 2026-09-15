import { t } from '@/i18n'

interface Filter {
  /** Shown in the native dialog's own chrome, so it is translated like the rest of it. */
  name: string
  extensions: string[]
}

/**
 * One file off disk, or null when the dialog was dismissed. The plugin is
 * imported lazily so jsdom never loads it for the suites that touch these paths
 * without opening anything.
 */
export const pickFile = async (filters?: Filter[]): Promise<string | null> => {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({ multiple: false, directory: false, filters })
  return typeof path === 'string' ? path : null
}

export const pickBackup = (): Promise<string | null> =>
  pickFile([{ name: t('Rowel backup'), extensions: ['rowel'] }])

export const pickImportFile = (): Promise<string | null> =>
  pickFile([{ name: t('Password exports'), extensions: ['json', 'csv'] }])

// No extension filter: a `.env` has none, and `.env.production` is not `.production`.
export const pickEnvFile = (): Promise<string | null> => pickFile()
