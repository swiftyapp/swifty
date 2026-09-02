import { NoteGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// A note has no favicon or brand mark to lead with, so the tile is always the
// kind-tinted glyph.
export default function ListRow({ entry, flag }: ContentProps) {
  return (
    <Row
      glyph={<NoteGlyph size={16} />}
      tint="note"
      title={entry.title}
      sub={listSubtitle(entry)}
      flag={flag}
    />
  )
}
