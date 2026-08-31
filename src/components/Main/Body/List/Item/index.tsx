import { cx } from '@/utils/cx'
import { useStore, setCurrentEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import Login from './Login'
import Card from './Card'
import Note from './Note'

interface Props {
  entry: EntryMeta
}

export default function Item({ entry }: Props) {
  const selected = useStore(state => state.entries.current?.id === entry.id)

  const content = () => {
    switch (entry.type) {
      case 'login':
        return <Login entry={entry} />
      case 'card':
        return <Card entry={entry} />
      case 'note':
        return <Note entry={entry} />
    }
  }

  return (
    <div
      className={cx(
        'flex cursor-pointer items-center gap-3 border-l-2 py-2.5 pl-[14px] pr-4',
        'shadow-[inset_0_-1px_0_var(--c-line)]',
        selected
          ? 'border-accent bg-sel'
          : 'border-transparent hover:bg-hover'
      )}
      data-testid="entry-item"
      onClick={() => setCurrentEntry(entry.id)}
    >
      {content()}
    </div>
  )
}
