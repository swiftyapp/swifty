import type { TFunction } from 'i18next'
import { isInvalidPassword, isVaultTooNew } from '@/lib/authErrors'

/**
 * A backend rejection as something showable. Rust errors arrive as plain
 * strings; anything else is a thrown JS error or, at worst, nothing worth
 * repeating — the caller falls back to its own wording for that.
 */
export const messageOf = (error: unknown): string =>
  typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''

/**
 * What to say when a pack refuses to open. The password is blamed only when the
 * backend actually said so: a pack written by a newer build would refuse the
 * right one too, and a download, a disk write or a token refresh can fail with
 * the password never having been checked — sending the user to retype it then
 * hides the cause they could act on. `wrongPassword` is the caller's wording,
 * since the one you want back differs by where the pack came from.
 */
export const unsealError = (
  t: TFunction,
  error: unknown,
  wrongPassword: string
): string =>
  isInvalidPassword(error)
    ? wrongPassword
    : isVaultTooNew(error)
      ? t('Vault needs a newer version of the app')
      : messageOf(error) || t('Something went wrong')
