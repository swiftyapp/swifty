import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { syncStatus } from '@/lib/commands'
import { t } from '@/i18n'

// The auth screens' footer: app version plus where the vault lives, in plain
// words. Replaces "offline · aes-256-gcm" — jargon that told users nothing
// and an "offline" that read as a (wrong) connectivity status. Both facts are
// safe to show while locked: the version is public and the sync flag is
// non-secret config.
export function useAuthMeta(): string | null {
  const [meta, setMeta] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      getVersion().catch(() => null),
      syncStatus().catch(() => ({ configured: false }))
    ]).then(([version, sync]) => {
      if (!alive) return
      const home = sync.configured
        ? t('Syncs with Google Drive')
        : t('Vault on this device')
      setMeta([version && `Swifty ${version}`, home].filter(Boolean).join(' · '))
    })
    return () => {
      alive = false
    }
  }, [])

  return meta
}
