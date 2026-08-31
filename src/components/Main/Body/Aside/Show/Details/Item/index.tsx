import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'
import { copy } from '@/services/copy'
import { openLink } from '@/services/openLink'
import Copy from '@/assets/images/copy.svg?react'

interface Props {
  entry: Entry
  name: string
  link?: boolean
  cc?: boolean
  secure?: boolean
}

export default function Item({ entry, name, link, cc, secure }: Props) {
  const raw =
    (entry as unknown as Record<string, string>)[name.toLowerCase()] ?? ''

  if (raw === '') return null

  const value = () => {
    if (link)
      return (
        <a
          href={raw}
          onClick={e => {
            e.preventDefault()
            openLink(raw)
          }}
        >
          {raw}
        </a>
      )
    if (cc) return raw.match(/.{1,4}/g)?.join(' ')
    return raw
  }

  return (
    <div className={secure ? 'item secure' : 'item'}>
      <div className="label">{t(name)}</div>
      <div className="value">{value()}</div>
      <Copy width="16" height="16" onClick={() => copy(raw)} />
    </div>
  )
}
