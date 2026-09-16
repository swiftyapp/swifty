import type { TFunction } from 'i18next'
import { describeError, errorKind } from '@/api/errors'

/**
 * What to say when a pack refuses to open. The password is blamed only when the
 * backend actually said so: a pack written by a newer build would refuse the
 * right one too, and a download, a disk write or a token refresh can fail with
 * the password never having been checked — sending the user to retype it then
 * hides the cause they could act on. `wrongPassword` is the caller's wording,
 * since the one you want back differs by where the pack came from.
 */
export const unsealError = (t: TFunction, error: unknown, wrongPassword: string): string => {
  switch (errorKind(error)) {
    case 'invalidPassword':
      return wrongPassword
    case 'vaultTooNew':
      return t('Vault needs a newer version of the app')
    default:
      return describeError(error) || t('Something went wrong')
  }
}
