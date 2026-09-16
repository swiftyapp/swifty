import { useApp } from '@/store'
import { t } from '@/i18n'
import { APP_NAME } from '@/lib/app'

export interface VaultMeta {
  version: string | null
  configured: boolean
}

// Where the vault lives, in one phrase.
export const vaultHome = (configured: boolean): string =>
  configured ? t('Syncs with Google Drive') : t('Vault on this device')

// The raw parts, for callers that lay them out themselves (the Settings footer).
// Two leaves of the launch probe, read from the store rather than fetched: null
// until it lands, and re-read whenever it is refreshed — so an unlock that turns
// sync on corrects the footer under it.
export function useVaultMeta(): VaultMeta | null {
  const status = useApp(state => state.status)
  return status && { version: status.version, configured: status.syncConfigured }
}

export function useAuthMeta(): string | null {
  const meta = useVaultMeta()
  if (!meta) return null
  const home = vaultHome(meta.configured)
  return meta.version ? `${APP_NAME} ${meta.version} · ${home}` : home
}
