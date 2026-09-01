import { t } from '@/i18n'
import type { Scope } from '@/store/filtersSlice'

// The list-column header shows a large title per scope. Kept here so the
// rail, list header, and any future scope-aware chrome stay in sync.
export const scopeTitle = (scope: Scope): string => {
  switch (scope) {
    case 'note':
      return t('Secure Notes')
    case 'card':
      return t('Credit Cards')
    case 'audit':
      return t('Vault Health')
    default:
      return t('Logins')
  }
}
