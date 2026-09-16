import { useApp } from '@/store'
import { t } from '@/i18n'
import { APP_NAME } from '@/lib/app'

export interface VaultMeta {
  version: string
  configured: boolean
}

// Where the vault lives, in one phrase.
export const vaultHome = (configured: boolean): string =>
  configured ? t('Syncs with Google Drive') : t('Vault on this device')

// The raw parts, for callers that lay them out themselves (the Settings footer).
// Read from the store rather than fetched: null until the launch probe lands,
// and re-read whenever either half changes — the version with the probe, and
// sync from the one place sync lives, so connecting Drive in Settings corrects
// the footer on the same screen instead of at the next lock.
export function useVaultMeta(): VaultMeta | null {
  const version = useApp(state => state.status?.version)
  const configured = useApp(state => state.sync.configured)
  return version === undefined ? null : { version, configured }
}

export function useAuthMeta(): string | null {
  const meta = useVaultMeta()
  if (!meta) return null
  const home = vaultHome(meta.configured)
  return meta.version ? `${APP_NAME} ${meta.version} · ${home}` : home
}
