import { LoginGlyph } from '@/components/Main/icons'
import Row, { type ContentProps } from './Row'

export default function Login({ entry, flag }: ContentProps) {
  return (
    <Row glyph={<LoginGlyph size={16} />} title={entry.title} sub={entry.urlHost} flag={flag} />
  )
}
