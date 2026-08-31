import type { EntryMeta } from '@/lib/commands'
import NoteIcon from '@/assets/images/notes/note.svg?react'

interface Props {
  entry: EntryMeta
}

export default function Note({ entry }: Props) {
  return (
    <>
      <div className="icon">
        <NoteIcon width="26" height="26" />
      </div>
      <div className="description">
        <div className="primary">{entry.title}</div>
      </div>
    </>
  )
}
