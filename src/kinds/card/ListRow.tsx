import { CardGlyph } from '@/components/Main/icons'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { hasBrandMark } from '@/utils/cardBrand'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// The card number is a secret (in the encrypted payload), so the list shows a
// static masked pattern rather than any real digits until the entry is
// revealed. The network mark comes from metadata derived at save time; without
// one the tile falls back to the kind-tinted generic glyph.
export default function ListRow({ entry, flag }: ContentProps) {
  const branded = hasBrandMark(entry.cardBrand)

  return (
    <Row
      glyph={
        branded ? (
          <CardBrandMark brand={entry.cardBrand} size={13} />
        ) : (
          <CardGlyph size={16} />
        )
      }
      tint={branded ? undefined : 'card'}
      title={entry.title}
      sub={listSubtitle()}
      flag={flag}
    />
  )
}
