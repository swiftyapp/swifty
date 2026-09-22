import type { TFunction } from 'i18next'
import type { Workspace } from '@/api/types'

/**
 * The workspace every install starts with, and the one whose key opens the
 * app: every other workspace's key is kept sealed under it on the device, and
 * the biometric enrollment stores it. A literal the backend agrees on rather
 * than "the first in the list": the list is ordered for display, and the
 * active one is identified by id everywhere else.
 */
export const PRIMARY_WORKSPACE = 'default'

/**
 * What to call a workspace on screen. The primary one has no name until someone
 * gives it one — it predates the whole idea — so it falls back to a word for
 * "the vault you already had".
 */
export const workspaceLabel = (workspace: Workspace, t: TFunction): string =>
  workspace.name ?? t('Personal')
