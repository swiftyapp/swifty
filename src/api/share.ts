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

// One live share, as the sender's own list of them reports it.
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

// Seal one entry, upload it, and return the link that opens it.
export const shareCreate = (entryId: string): Promise<ShareCreated> =>
  call('share_create', { entryId })

/**
 * Fetch and unseal whatever a link points at. The entry arrives with `id: ''`
 * and no timestamps: it is a copy waiting to be adopted, not the sender's row,
 * so the recipient's own save mints both.
 */
export const shareOpen = (link: string): Promise<Entry> => call('share_open', { link })

// Delete the uploaded file, before its 24 hours are up.
export const shareRevoke = (fileId: string): Promise<void> =>
  call('share_revoke', { fileId })

export const shareList = (): Promise<ActiveShare[]> => call('share_list')
