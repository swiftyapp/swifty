import type { EntryMeta } from '@/lib/commands'
import { toggleFavorite } from '@/store'
import { useTranslation } from 'react-i18next'
import IconButton from '@/components/elements/IconButton'
import { StarGlyph } from '../../../icons'

// The star, next to the read header's action cluster. A metadata-only write, so
// it needs no reveal and stays available while the payload is still in flight.
// `className` is how the phone's nav row grows it to a 44px target.
export default function Favorite({
  entry,
  className
}: {
  entry: EntryMeta
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <IconButton
      title={entry.favorite ? t('Remove from Favorites') : t('Add to Favorites')}
      active={entry.favorite}
      onClick={() => void toggleFavorite(entry.id)}
      className={className}
      testid="favorite-toggle"
    >
      <StarGlyph filled={entry.favorite} />
    </IconButton>
  )
}
