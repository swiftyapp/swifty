import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import type { View } from '@/store/uiSlice'
import { kindOf } from '@/kinds'
import type { TKey } from '@/i18n'

// The column is titled after the view, except in All Items, where a kind chip
// renames it to what it is now showing ("Logins"). The other views keep their
// own name: "Logins" would lose the fact that you are looking at the Archive.
const TITLES: Record<View, TKey> = {
  items: 'All Items',
  favorites: 'Favorites',
  health: 'Vault Health',
  archive: 'Archive'
}

// A hook rather than a constant in the column, because the compact shell draws
// the same name in its own large title: one computation, two headers.
export const useListTitle = (): string => {
  const { t } = useTranslation()
  const view = useStore(state => state.ui.view)
  const type = useStore(state => state.filters.type)

  return view === 'items' && type ? t(kindOf(type).pluralLabel) : t(TITLES[view])
}
