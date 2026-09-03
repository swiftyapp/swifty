import { IdentityGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from '@/components/Main/Body/List/Item/Row'
import { listSubtitle } from './meta'

// Which document this is lives in the encrypted payload, so every identity row
// wears the same kind-tinted glyph — there is no non-secret metadata that could
// tell a passport from a licence without decrypting the entry.
export default function ListRow({ entry, flag }: ContentProps) {
  return (
    <Row
      glyph={<IdentityGlyph size={16} />}
      tint="identity"
      title={entry.title}
      sub={listSubtitle(entry)}
      flag={flag}
    />
  )
}
