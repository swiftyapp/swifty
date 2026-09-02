import type { EntryMeta } from '@/lib/commands'
import { toggleFavorite } from '@/store'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { StarGlyph } from '../../../icons'

// The star, next to the read header's action cluster. A metadata-only write, so
// it needs no reveal and stays available while the payload is still in flight.
export default function Favorite({ entry }: { entry: EntryMeta }) {
  return (
    <IconButton
      title={entry.favorite ? t('Remove from Favorites') : t('Add to Favorites')}
      active={entry.favorite}
      onClick={() => void toggleFavorite(entry.id)}
      testid="favorite-toggle"
    >
      <StarGlyph filled={entry.favorite} />
    </IconButton>
  )
}
