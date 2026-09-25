import type { TFunction } from 'i18next'
import type { Workspace } from '@/api/types'
import { syncDeletedRemotely, type SyncStatus } from '@/api/sync'

/**
 * Whether a workspace syncs, and so has a copy on Drive. The open one is
 * answered by its live connection — not once the account's copy is gone
 * (deleted from another device); a locked one by the connection the backend
 * found in its own directory when the list was built (`synced`) — not by its
 * vault id, which a disconnect leaves behind.
 */
export const workspaceSyncs = (
  workspace: Workspace,
  { active, sync }: { active: string; sync: SyncStatus }
): boolean =>
  workspace.id === active
    ? sync.configured && !syncDeletedRemotely(sync)
    : workspace.synced === true

interface Context {
  // The open workspace answers from its live session; a locked one only from
  // what the registry kept about it.
  current: boolean
  syncs: boolean
  liveCount: number
}

/**
 * A workspace's size and where it lives, as one meta line ("284 items · Google
 * Drive"). The same facts the lock screen's picker says of each vault — the
 * open one's count is the live list rather than the registry's as-of-last-open
 * one. A locked vault never opened here since counts were kept has no count.
 */
export const workspaceAbout = (
  workspace: Workspace,
  { current, syncs, liveCount }: Context,
  t: TFunction
): string => {
  const home = syncs ? t('Google Drive') : t('This device')
  const count = current ? liveCount : workspace.itemCount
  return count === undefined ? home : `${t('{{count}} items', { count })} · ${home}`
}
