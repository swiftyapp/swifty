import { EnvGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// The file lives in the payload and nothing non-secret yet tells one env file
// from another, so the tile is always the kind-tinted glyph.
export default function ListRow({ entry, flag }: ContentProps) {
  return (
    <Row
      glyph={<EnvGlyph size={16} />}
      tint="env"
      title={entry.title}
      sub={listSubtitle(entry)}
      flag={flag}
    />
  )
}
