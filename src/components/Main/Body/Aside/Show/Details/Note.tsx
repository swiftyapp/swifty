import type { NoteEntry } from '@/lib/commands'
import Item from './Item'
import Tags from './Item/Tags'

interface Props {
  entry: NoteEntry
}

export default function Note({ entry }: Props) {
  return (
    <div className="entry-details">
      <Item name="Note" entry={entry} secure />
      <Tags entry={entry} />
    </div>
  )
}
