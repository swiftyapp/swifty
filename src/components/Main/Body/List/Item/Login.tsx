import { LoginGlyph } from '@/components/Main/icons'
import { useFavicon } from '@/hooks/useFavicon'
import Row, { type ContentProps } from './Row'

// A login row leads with the site's own favicon when one exists — real
// identity beats a generic globe. The glyph stands in while it loads or when
// the host has none.
export default function Login({ entry, flag }: ContentProps) {
  const icon = useFavicon(entry.urlHost)

  return (
    <Row
      glyph={icon ? <img src={icon} alt="" className="h-4 w-4" /> : <LoginGlyph size={16} />}
      title={entry.title}
      sub={entry.urlHost}
      flag={flag}
    />
  )
}
