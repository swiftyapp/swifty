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

export const isTooManyAttempts = (
  error: unknown
): error is BackendError & { retryAfterSecs: number } =>
  errorKind(error) === 'tooManyAttempts' &&
  typeof (error as BackendError).retryAfterSecs === 'number'
