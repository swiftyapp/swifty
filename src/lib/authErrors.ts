/**
 * The backend error strings every screen that unseals something has to tell
 * apart. Rust serializes `Error::VaultTooNew` and `Error::InvalidPassword` as
 * plain strings (see error.rs); `Error::TooManyAttempts` is the one that comes
 * back as an object.
 *
 * Shared rather than per-screen so the lock screen, the Drive restore and the
 * backup restore all map the same error to the same message — blaming the
 * password for a schema that is simply ahead of this build would send the user
 * retyping a password that was never wrong.
 */

interface TooManyAttemptsError {
  retryAfterSecs: number
}

export const isTooManyAttempts = (error: unknown): error is TooManyAttemptsError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as TooManyAttemptsError).retryAfterSecs === 'number'

/** The stored data's schema is newer than this build can read. */
export const isVaultTooNew = (error: unknown): boolean =>
  error === 'vault requires a newer version of the app'

/** The password did not open it. Anything else is a transport or disk problem. */
export const isInvalidPassword = (error: unknown): boolean =>
  error === 'invalid master password'
