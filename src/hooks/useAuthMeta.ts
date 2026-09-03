import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { syncStatus } from '@/lib/commands'
import { t } from '@/i18n'
import { APP_NAME } from '@/lib/app'

export interface VaultMeta {
  version: string | null
  configured: boolean
}

let cached: Promise<VaultMeta> | null = null

const load = () =>
  (cached ??= Promise.all([
    getVersion().catch(() => null),
    syncStatus().catch(() => ({ configured: false }))
  ]).then(([version, sync]) => ({ version, configured: sync.configured })))

// Where the vault lives, in one phrase.
export const vaultHome = (configured: boolean): string =>
  configured ? t('Syncs with Google Drive') : t('Vault on this device')

// The raw parts, for callers that lay them out themselves (the Settings footer).
export function useVaultMeta(): VaultMeta | null {
  const [meta, setMeta] = useState<VaultMeta | null>(null)

  useEffect(() => {
    let alive = true
    load().then(next => {
      if (alive) setMeta(next)
    })
    return () => {
      alive = false
    }
  }, [])

  return meta
}

export function useAuthMeta(): string | null {
  const meta = useVaultMeta()
  if (!meta) return null
  const home = vaultHome(meta.configured)
  return meta.version ? `${APP_NAME} ${meta.version} · ${home}` : home
}
