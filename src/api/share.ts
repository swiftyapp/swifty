import { call } from './client'
import type { Entry, EntryType } from './types'

/**
 * Credential sharing. The entry is sealed here and uploaded to the sender's own
 * Drive; the key travels in the link and never reaches Google, so the file is
 * ciphertext to everyone but whoever holds the link.
 */
export interface ShareCreated {
  link: string
  fileId: string
  /** ISO 8601; a share lives 24 hours unless it is revoked first. */
  expiresAt: string
}

/**
 * One live share, as the sender's own list of them reports it. Every row here
 * was published by the vault currently open — Rust filters on that, and refuses
 * a revoke of anything else — so nothing names a vault.
 */
export interface ActiveShare {
  fileId: string
  /**
   * The sender's local entry id, or null once that entry is gone. A share is a
   * copy, so the entry it came from can be deleted without touching it.
   */
  entryId: string | null
  kind: EntryType | null
  createdAt: string
  expiresAt: string
}

/**
 * Seal one entry, upload it, and return the link that opens it. Rejects with
 * `shareNeedsSync` until this workspace has synced once: a share is stamped with
 * the vault's id, and the id is what a later list or revoke finds it by, so a
 * vault that has no id yet has nothing to publish a link under.
 */
export const shareCreate = (entryId: string): Promise<ShareCreated> =>
  call('share_create', { entryId })

/**
 * Fetch and unseal whatever a link points at. The entry arrives with `id: ''`
 * and no timestamps: it is a copy waiting to be adopted, not the sender's row,
 * so the recipient's own save mints both.
 */
export const shareOpen = (link: string): Promise<Entry> => call('share_open', { link })

/**
 * Delete the uploaded file, before its 24 hours are up. Rejects with
 * `shareNotOwned` if the file belongs to another workspace's vault, which only
 * a stale list can produce.
 */
export const shareRevoke = (fileId: string): Promise<void> =>
  call('share_revoke', { fileId })

/** This vault's outstanding shares; another vault's in the same account are not ours to see. */
export const shareList = (): Promise<ActiveShare[]> => call('share_list')
