import type { NoteEntry } from '@/lib/commands'
import Tags from './Item/Tags'
import { Panel } from '../../ui'

interface Props {
  entry: NoteEntry
}

export default function Note({ entry }: Props) {
  return (
    <div className="mt-3">
      <Panel>
        <div
          className="whitespace-pre-wrap break-words px-4 py-4 text-base leading-relaxed text-text2"
          data-testid="entry-value-note"
        >
          {entry.note}
        </div>
      </Panel>
      <Tags entry={entry} />
    </div>
  )
}
