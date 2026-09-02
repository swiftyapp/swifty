import type { Entry } from '@/lib/commands'
import { kindOf } from '@/kinds'

interface Props {
  entry: Entry
}

export default function Details({ entry }: Props) {
  const Body = kindOf(entry.type).Details
  return <Body entry={entry} />
}
