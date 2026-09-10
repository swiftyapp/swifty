import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import type { View } from '@/store/uiSlice'
import { kindOf } from '@/kinds'
import type { TKey } from '@/i18n'

// The column is titled after the view, except in All Items, where a kind chip
// renames it to what it is now showing ("Logins"), and in Tags, where the
// picked tag does ("#work"). The other views keep their own name: "Logins"
// would lose the fact that you are looking at the Archive.
const TITLES: Record<View, TKey> = {
  items: 'All Items',
  favorites: 'Favorites',
  health: 'Vault Health',
  archive: 'Archive',
  tags: 'Tags'
}

// A hook rather than a constant in the column, because the compact shell draws
// the same name in its own large title: one computation, two headers.
export const useListTitle = (): string => {
  const { t } = useTranslation()
  const view = useStore(state => state.ui.view)
  const type = useStore(state => state.filters.type)
  const tag = useStore(state => state.filters.tag)

  if (view === 'items' && type) return t(kindOf(type).pluralLabel)
  if (view === 'tags' && tag) return `#${tag}`
  return t(TITLES[view])
}
