import { useApp } from '@/store'

export interface VaultMeta {
  version: string
  configured: boolean
}

// Where the vault lives, in one phrase.
// The raw parts, for the footers that lay them out themselves (Settings, the
// lock screen). Read from the store rather than fetched: null until the launch
// probe lands, and re-read whenever either half changes — the version with the
// probe, and sync from the one place sync lives, so connecting Drive in
// Settings corrects the footer on the same screen instead of at the next lock.
export function useVaultMeta(): VaultMeta | null {
  const version = useApp(state => state.status?.version)
  const configured = useApp(state => state.sync.configured)
  return version === undefined ? null : { version, configured }
}
