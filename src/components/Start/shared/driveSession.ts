import { setupDriveConnect, setupDriveDisconnect } from '@/api/setup'
import { setupDrivePending, setupDriveFailed, setupDriveReset } from '@/store'
import { messageOf } from '@/api/errors'

/**
 * Open the Google consent flow for a device that has no data yet.
 *
 * The store is moved to `pending` here rather than waiting for
 * `setup:drive:pending`: the press has to change the screen in the same frame,
 * and the event only confirms what this already said. A rejection is an
 * immediate failure (no OAuth client, no browser) and lands in the same place
 * `setup:drive:error` would.
 */
export const connectDrive = (): void => {
  setupDrivePending()
  setupDriveConnect().catch((error: unknown) => setupDriveFailed(messageOf(error)))
}

/** Drop the pending tokens and everything the probe said about them. */
export const forgetDrive = (): void => {
  setupDriveReset()
  setupDriveDisconnect().catch(() => {})
}

/** Sign in as somebody else: the old tokens have to go first. */
export const switchDriveAccount = (): void => {
  setupDrivePending()
  setupDriveDisconnect()
    .catch(() => {})
    .then(() => setupDriveConnect())
    .catch((error: unknown) => setupDriveFailed(messageOf(error)))
}
