import { NoteGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from './Row'

// The note body is a secret, so there is no snippet to preview in the list; the
// tags (non-secret metadata) stand in as the secondary line when present.
export default function Note({ entry, flag }: ContentProps) {
  const sub = entry.tags.length > 0 ? entry.tags.join(' · ') : undefined
  return <Row glyph={<NoteGlyph size={16} />} title={entry.title} sub={sub} flag={flag} />
}
