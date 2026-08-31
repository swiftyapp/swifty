import type { EntryMeta } from '@/lib/commands'
import { LoginGlyph } from '@/components/Main/icons'
import Row from './Row'

interface Props {
  entry: EntryMeta
}

export default function Login({ entry }: Props) {
  return (
    <Row glyph={<LoginGlyph size={16} />} title={entry.title} sub={entry.urlHost} />
  )
}
