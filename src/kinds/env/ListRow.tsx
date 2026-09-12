import { EnvGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// The file lives in the payload, so the tile is always the kind-tinted glyph;
// what tells one env file from another is the subtitle, drawn from the file
// name and variable count stamped into the metadata at save time.
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
