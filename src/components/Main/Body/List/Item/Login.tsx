import type { EntryMeta } from '@/lib/commands'
import icons, { iconKeyForWebsite } from '@/defaults/icons'

interface Props {
  entry: EntryMeta
}

export default function Login({ entry }: Props) {
  const icon = icons[iconKeyForWebsite(entry.urlHost)] ?? icons.default
  const Icon = icon.icon

  return (
    <>
      <div className="icon web" style={{ backgroundColor: icon.color }}>
        <Icon width="20" height="20" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
        <div className="secondary">{entry.urlHost}</div>
      </div>
    </>
  )
}
