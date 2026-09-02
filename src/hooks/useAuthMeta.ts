import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { syncStatus } from '@/lib/commands'
import { t } from '@/i18n'

// Both facts are constant for the app's lifetime (the sync flag can't change
// while locked, and unlocking navigates away), so one pair of IPC calls
// serves every auth-screen mount.
let cached: Promise<{ version: string | null; configured: boolean }> | null =
  null

const load = () =>
  (cached ??= Promise.all([
    getVersion().catch(() => null),
    syncStatus().catch(() => ({ configured: false }))
  ]).then(([version, sync]) => ({ version, configured: sync.configured })))

// The auth screens' footer: app version plus where the vault lives, in plain
// words. Replaces "offline · aes-256-gcm" — jargon that told users nothing
// and an "offline" that read as a (wrong) connectivity status. Both facts are
// safe to show while locked: the version is public and the sync flag is
// non-secret config.
export function useAuthMeta(): string | null {
  const [meta, setMeta] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    load().then(({ version, configured }) => {
      if (!alive) return
      const home = configured
        ? t('Syncs with Google Drive')
        : t('Vault on this device')
      setMeta(version ? `Swifty ${version} · ${home}` : home)
    })
    return () => {
      alive = false
    }
  }, [])

  return meta
}
