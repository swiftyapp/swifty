import type { TFunction } from 'i18next'
import { isVaultTooNew } from '@/lib/authErrors'

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
 * What to say when a pack refuses to open. Nearly always the password, but a
 * pack written by a newer build would refuse the right one too — so that case
 * gets its own message rather than sending the user to retype a password that
 * was never the problem. `wrongPassword` is the caller's wording, since the
 * one you want back differs by where the pack came from.
 */
export const unsealError = (
  t: TFunction,
  error: unknown,
  wrongPassword: string
): string =>
  isVaultTooNew(error) ? t('Vault needs a newer version of the app') : wrongPassword
