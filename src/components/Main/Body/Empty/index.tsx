import type { ReactElement } from 'react'
import { useStore } from '@/store'
import { useVariant, type Variant } from './variant'
import {
  KindEmpty,
  SearchEmpty,
  SelectEmpty,
  VaultEmpty,
  HealthEmpty,
  FavoritesEmpty,
  TrashEmpty
} from './variants'

// The list column's share: only the filter states, and only ever as one line.
// On `vault` and `health` it renders nothing at all — the detail pane is
// saying it, and a second empty state next to it would just be noise.
export default function ListEmpty() {
  const variant = useVariant()
  const type = useStore(state => state.filters.type)
  const query = useStore(state => state.filters.query)

  if (variant === 'search') return <SearchEmpty query={query.trim()} type={type} />
  // `kind` is unreachable without a filter, but the type still has to narrow.
  if (variant === 'kind' && type) return <KindEmpty type={type} />
  return null
}

// The filter states have already been explained in the list column, so the
// pane stays on the quiet select rather than answering them a second time.
const DETAIL: Record<Variant, () => ReactElement> = {
  vault: VaultEmpty,
  health: HealthEmpty,
  favorites: FavoritesEmpty,
  trash: TrashEmpty,
  kind: SelectEmpty,
  search: SelectEmpty,
  select: SelectEmpty
}

// The detail pane's share: every variant lands somewhere, centered in the pane.
export function DetailEmpty({ variant }: { variant: Variant }) {
  const Content = DETAIL[variant]

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Content />
    </div>
  )
}
