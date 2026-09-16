import { t } from '@/i18n'

/**
 * Every command rejection from Rust arrives as one of these. The `kind` is what
 * screens branch on — the message is for the user and may be shown as is, but
 * matching on its text is how the same failure used to read differently on two
 * screens the moment Rust reworded it.
 */
export type BackendErrorKind =
  | 'invalidPassword'
  | 'vaultTooNew'
  | 'tooManyAttempts'
  | 'locked'
  | 'notFound'
  | 'cancelled'
  | 'syncNotConfigured'
  | 'unsupported'
  | 'unrecognized'
  | 'io'
  | 'serde'
  | 'crypto'
  | 'other'

export interface BackendError {
  kind: BackendErrorKind
  message: string
  /** Only on `tooManyAttempts`: seconds until another attempt is accepted. */
  retryAfterSecs?: number
}

export const isBackendError = (error: unknown): error is BackendError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as BackendError).kind === 'string' &&
  typeof (error as BackendError).message === 'string'

export const errorKind = (error: unknown): BackendErrorKind | null =>
  isBackendError(error) ? error.kind : null

/**
 * A rejection as something showable. Empty when there is nothing worth
 * repeating, so a caller can fall back to its own wording with `||`.
 */
export const messageOf = (error: unknown): string =>
  isBackendError(error) ? error.message : error instanceof Error ? error.message : ''

/**
 * A rejection as copy the user can read in their own language. Rust's `message`
 * is English source text, so anything with a stable meaning to a user is said
 * here instead of repeated from the wire. `io`, `serde`, `crypto` and `other`
 * carry a path, a parser position or a driver's words — diagnostics, not copy —
 * so those keep the raw message, as does anything that is not a `BackendError`.
 *
 * `unsupported` keeps its message too, for a different reason: Rust builds it
 * per call site ("a login whose only secret is a passkey cannot be shared"), and
 * a translated "not supported here" would throw away the only part the user can
 * act on.
 */
export const describeError = (error: unknown): string => {
  if (!isBackendError(error)) return messageOf(error)

  switch (error.kind) {
    case 'invalidPassword':
      return t('Incorrect Master Password')
    case 'vaultTooNew':
      return t('Vault needs a newer version of the app')
    case 'tooManyAttempts':
      return t('Too many failed attempts. Try again in {{seconds}}s', {
        seconds: error.retryAfterSecs ?? 0
      })
    case 'locked':
      return t('Vault is locked')
    case 'notFound':
      return t('Item not found')
    case 'cancelled':
      return t('Cancelled')
    case 'syncNotConfigured':
      return t('Sync is not set up')
    case 'unrecognized':
      return t('Nothing recognized')
    default:
      return messageOf(error)
  }
}

export const isTooManyAttempts = (
  error: unknown
): error is BackendError & { retryAfterSecs: number } =>
  errorKind(error) === 'tooManyAttempts' &&
  typeof (error as BackendError).retryAfterSecs === 'number'
