import { CardGlyph } from '@/components/Main/icons'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { hasBrandMark } from '@/utils/cardBrand'
import Row, { type ContentProps } from './Row'

// The card number is a secret (in the encrypted payload), so the list shows a
// static masked pattern rather than any real digits until the entry is
// revealed. The network mark comes from metadata derived at save time.
export default function Card({ entry, flag }: ContentProps) {
  return (
    <Row
      glyph={
        hasBrandMark(entry.cardBrand) ? (
          <CardBrandMark brand={entry.cardBrand} size={13} />
        ) : (
          <CardGlyph size={16} />
        )
      }
      title={entry.title}
      sub="•••• •••• •••• ••••"
      flag={flag}
    />
  )
}
