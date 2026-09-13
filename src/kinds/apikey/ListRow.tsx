import { ApiKeyGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// Nothing about a key is public metadata — the API it is for is in the
// payload — so the tile is always the kind-tinted glyph.
export default function ListRow({ entry, flag }: ContentProps) {
  return (
    <Row
      glyph={<ApiKeyGlyph size={16} />}
      tint="apikey"
      title={entry.title}
      sub={listSubtitle(entry)}
      flag={flag}
    />
  )
}
