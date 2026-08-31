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
  const current = useStore(state => state.entries.current)

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
      className={cx('entry', { current: current?.id === entry.id })}
      onClick={() => setCurrentEntry(entry.id)}
    >
      {content()}
    </div>
  )
}
