import type { CardEntry } from '@/lib/commands'
import Item from './Item'
import Tags from './Item/Tags'

interface Props {
  entry: CardEntry
}

export default function Card({ entry }: Props) {
  return (
    <div className="entry-details">
      <Item name="Number" entry={entry} cc />
      <Item name="Year" entry={entry} />
      <Item name="Month" entry={entry} />
      <Item name="CVC" entry={entry} />
      <Item name="Pin" entry={entry} secure />
      <Item name="Name" entry={entry} />
      <Tags entry={entry} />
    </div>
  )
}
