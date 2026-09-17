import { setupDriveConnect, setupDriveDisconnect } from '@/api/setup'
import { workspaceDriveConnect } from '@/api/workspace'
import { setupDrivePending, setupDriveFailed, setupDriveReset } from './app'
import { describeError } from '@/api/errors'

/**
 * Connecting a Google account for a vault that does not exist yet.
 *
 * Two screens do this — the first run, and Settings › Workspaces restoring one
 * of the account's other vaults — and they differ in one thing: which command
 * starts the consent, since the backend refuses onboarding's once a vault is on
 * disk. Everything else is shared, including the `setupDrive` slice the probe's
 * answer lands in, because only one of the two flows can ever be on screen.
 */

type Connect = () => Promise<void>

/**
 * The store is moved to `pending` here rather than waiting for
 * `setup:drive:pending`: the press has to change the screen in the same frame,
 * and the event only confirms what this already said. A rejection is an
 * immediate failure (no OAuth client, no browser) and lands in the same place
 * `setup:drive:error` would.
 */
const start = (connect: Connect): void => {
  setupDrivePending()
  connect().catch((error: unknown) => setupDriveFailed(describeError(error)))
}

/** Sign in as somebody else: the old tokens have to go first. */
const switchAccount = (connect: Connect): void => {
  setupDrivePending()
  setupDriveDisconnect()
    .catch(() => {})
    .then(connect)
    .catch((error: unknown) => setupDriveFailed(describeError(error)))
}

/** Open the Google consent flow for a device that has no data yet. */
export const connectDrive = (): void => start(setupDriveConnect)

/** The same, for a device that has data and wants another of the account's. */
export const connectWorkspaceDrive = (): void => start(workspaceDriveConnect)

export const switchDriveAccount = (): void => switchAccount(setupDriveConnect)

export const switchWorkspaceDriveAccount = (): void => switchAccount(workspaceDriveConnect)

/** Drop the pending tokens and everything the probe said about them. */
export const forgetDrive = (): void => {
  setupDriveReset()
  setupDriveDisconnect().catch(() => {})
}
