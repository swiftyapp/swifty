import { setupDriveConnect, setupDriveDisconnect } from '@/api/setup'
import { setupDrivePending, setupDriveFailed, setupDriveReset } from './app'
import { describeError } from '@/api/errors'

/**
 * Connecting a Google account for a vault that does not exist yet.
 *
 * Which command starts the consent is the only thing a caller varies: the
 * backend has one entry point per precondition. Everything else is shared,
 * including the `setupDrive` slice the probe's answer lands in.
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

export const switchDriveAccount = (): void => switchAccount(setupDriveConnect)

/** Drop the pending tokens and everything the probe said about them. */
export const forgetDrive = (): void => {
  setupDriveReset()
  setupDriveDisconnect().catch(() => {})
}
