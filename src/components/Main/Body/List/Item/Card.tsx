import type { EntryMeta } from '@/lib/commands'
import { CardGlyph } from '@/components/Main/icons'
import Row from './Row'

interface Props {
  entry: EntryMeta
}

// The card number is a secret (in the encrypted payload), so the list shows a
// static masked pattern rather than any real digits until the entry is revealed.
export default function Card({ entry }: Props) {
  return (
    <Row glyph={<CardGlyph size={16} />} title={entry.title} sub="•••• •••• •••• ••••" />
  )
}
